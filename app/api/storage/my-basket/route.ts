import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import {
  saveBasketConnection,
  testBasketConnection,
  type BasketConnectionInput,
} from "@/lib/storage/my-basket";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  const pool = getPostgresPool();
  if (!pool) return NextResponse.json({ configured: false, error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  try {
    const result = await pool.query(
      "SELECT provider, endpoint, region, bucket, updated_at FROM user_storage_connections WHERE owner_id = $1",
      [user.id],
    );
    return NextResponse.json({
      configured: Boolean(result.rows[0]),
      connection: result.rows[0] ? {
        provider: result.rows[0].provider,
        endpoint: result.rows[0].endpoint,
        region: result.rows[0].region,
        bucket: result.rows[0].bucket,
        updatedAt: result.rows[0].updated_at,
      } : null,
    });
  } catch {
    return NextResponse.json({ error: "MY_BASKET_NOT_AVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_STORAGE_CONNECTION" }, { status: 400 });
  }
  if (!isBasketConnection(input)) return NextResponse.json({ error: "INVALID_STORAGE_CONNECTION" }, { status: 400 });
  try {
    await testBasketConnection(input);
    await saveBasketConnection(user.id, input);
    return NextResponse.json({ status: "PASS", message: "External bucket verified; credentials encrypted and stored." });
  } catch (error) {
    return NextResponse.json({ status: "FAIL", error: publicError(error) }, { status: 400 });
  }
}

function isBasketConnection(value: unknown): value is BasketConnectionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return ["s3_compatible", "cloudflare_r2", "digitalocean_spaces", "backblaze_b2"].includes(String(input.provider)) &&
    ["endpoint", "region", "bucket", "accessKeyId", "secretAccessKey"].every((field) =>
      typeof input[field] === "string" && input[field].length <= 1024);
}

function publicError(error: unknown): string {
  if (!(error instanceof Error)) return "MY_BASKET_CONNECTION_FAILED";
  return /^[A-Z0-9_:-]{1,160}$/.test(error.message) ? error.message : "MY_BASKET_CONNECTION_FAILED";
}
