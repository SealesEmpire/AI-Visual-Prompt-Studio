import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import { assetStorageProvider } from "@/lib/storage/s3";

export async function GET(
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
      `SELECT result_asset->>'storageKey' AS storage_key
       FROM generation_jobs
       WHERE owner_id = $1 AND result_asset->>'id' = $2`,
      [user.id, id],
    );
    const storageKey: unknown = result.rows[0]?.storage_key;
    if (typeof storageKey !== "string") {
      return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    }
    const signedUrl = await assetStorageProvider().signedReadUrl(storageKey, user.id);
    return NextResponse.redirect(signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "ASSET_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}
