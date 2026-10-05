import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import { ConfiguredAssetDeliveryService } from "@/lib/storage/my-basket";
import type { AssetDestination } from "@/lib/storage/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  const { id } = await params;
  const pool = getPostgresPool();
  if (!pool) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try {
    const result = await pool.query(
      `SELECT id, media_asset_id, destination, attempt_count
       FROM asset_delivery_jobs WHERE id = $1 AND owner_id = $2 AND status = 'FAILED'`,
      [id, user.id],
    );
    const delivery = result.rows[0];
    if (!delivery) return NextResponse.json({ error: "ASSET_DELIVERY_NOT_RETRYABLE" }, { status: 409 });
    if (Number(delivery.attempt_count) >= 5) {
      return NextResponse.json({ error: "ASSET_DELIVERY_RETRY_LIMIT_REACHED" }, { status: 409 });
    }
    await pool.query(
      "UPDATE asset_delivery_jobs SET status = 'PROCESSING', attempt_count = attempt_count + 1, last_error = NULL WHERE id = $1 AND owner_id = $2",
      [id, user.id],
    );
    await new ConfiguredAssetDeliveryService().deliver(
      user.id,
      String(delivery.media_asset_id),
      delivery.destination as AssetDestination,
    );
    await pool.query("UPDATE asset_delivery_jobs SET status = 'COMPLETE' WHERE id = $1 AND owner_id = $2", [id, user.id]);
    return NextResponse.json({ id, status: "COMPLETE" });
  } catch (error) {
    const message = safeError(error);
    await pool.query(
      "UPDATE asset_delivery_jobs SET status = 'FAILED', last_error = $3 WHERE id = $1 AND owner_id = $2",
      [id, user.id, message],
    ).catch(() => undefined);
    return NextResponse.json({ id, status: "FAILED", error: message }, { status: 502 });
  }
}

function safeError(error: unknown): string {
  return error instanceof Error && /^[A-Z0-9_:-]{1,160}$/.test(error.message)
    ? error.message
    : "ASSET_DELIVERY_FAILED";
}
