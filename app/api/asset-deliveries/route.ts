import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import { ConfiguredAssetDeliveryService } from "@/lib/storage/my-basket";
import type { AssetDestination } from "@/lib/storage/repositories";
import { checkRateLimit } from "@/lib/security/rate-limit";

const destinations = ["device", "app_library", "my_basket"] as const;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  try {
    const limit = await checkRateLimit(user.id, "asset-delivery", 30, 3600);
    if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  } catch {
    return NextResponse.json({ error: "RATE_LIMIT_SERVICE_UNAVAILABLE" }, { status: 503 });
  }
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_ASSET_DELIVERY" }, { status: 400 });
  }
  if (!isRecord(input) || typeof input.assetId !== "string" || !isUuid(input.assetId) ||
      !destinations.includes(input.destination as AssetDestination)) {
    return NextResponse.json({ error: "INVALID_ASSET_DELIVERY" }, { status: 400 });
  }
  const pool = getPostgresPool();
  if (!pool) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const ownerAsset = await pool.query("SELECT id FROM media_assets WHERE id = $1 AND owner_id = $2", [input.assetId, user.id]);
  if (!ownerAsset.rows[0]) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });

  const deliveryId = randomUUID();
  try {
    await pool.query(
      "INSERT INTO asset_delivery_jobs (id, owner_id, media_asset_id, destination, status) VALUES ($1, $2, $3, $4, 'PROCESSING')",
      [deliveryId, user.id, input.assetId, input.destination],
    );
    const result = await new ConfiguredAssetDeliveryService().deliver(
      user.id,
      input.assetId,
      input.destination as AssetDestination,
    );
    await pool.query("UPDATE asset_delivery_jobs SET status = 'COMPLETE' WHERE id = $1 AND owner_id = $2", [deliveryId, user.id]);
    return NextResponse.json({ id: deliveryId, status: "COMPLETE", ...result });
  } catch (error) {
    const message = safeError(error);
    await pool.query(
      "UPDATE asset_delivery_jobs SET status = 'FAILED', last_error = $3 WHERE id = $1 AND owner_id = $2",
      [deliveryId, user.id, message],
    ).catch(() => undefined);
    return NextResponse.json({ id: deliveryId, status: "FAILED", error: message }, { status: 502 });
  }
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "ASSET_DELIVERY_FAILED";
  return /^[A-Z0-9_:-]{1,160}$/.test(error.message) ? error.message : "ASSET_DELIVERY_FAILED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
