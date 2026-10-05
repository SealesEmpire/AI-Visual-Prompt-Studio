import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { getPostgresPool } from "@/lib/database/postgres";
import { assetStorageProvider } from "@/lib/storage/s3";
import type { MediaKind } from "@/types/application";

export const runtime = "nodejs";

const maxFileSize = 100 * 1024 * 1024;
const allowed = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
]);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > maxFileSize + 64 * 1024) {
    return NextResponse.json({ error: "UPLOAD_TOO_LARGE" }, { status: 413 });
  }

  const pool = getPostgresPool();
  if (!pool) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_UPLOAD" }, { status: 400 });
  }
  const file = form.get("file");
  const projectId = form.get("projectId");
  if (!(file instanceof File) || typeof projectId !== "string" || !isUuid(projectId)) {
    return NextResponse.json({ error: "INVALID_UPLOAD" }, { status: 400 });
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (
    file.size <= 0 ||
    file.size > maxFileSize ||
    allowed.get(extension) !== file.type
  ) return NextResponse.json({ error: "UNSUPPORTED_MEDIA_FILE" }, { status: 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(bytes, file.type)) {
    return NextResponse.json({ error: "MEDIA_SIGNATURE_INVALID" }, { status: 415 });
  }

  const id = randomUUID();
  const mediaType: MediaKind = file.type.startsWith("video/") ? "video" : "image";
  let storageKey: string | undefined;
  try {
    const project = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
      [projectId, user.id],
    );
    if (!project.rows[0]) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

    storageKey = await assetStorageProvider().store({
      ownerId: user.id,
      assetId: id,
      bytes,
      mimeType: file.type,
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO media_assets (id, owner_id, project_id, type, mime_type, storage_key, size, checksum)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, user.id, projectId, mediaType, file.type, storageKey, bytes.length, createHash("sha256").update(bytes).digest("hex")],
      );
      await client.query(
        `UPDATE projects
         SET payload = jsonb_set(
           payload,
           '{assets}',
           COALESCE(payload->'assets', '[]'::jsonb) || $3::jsonb,
           true
         ), updated_at = now()
         WHERE id = $1 AND owner_id = $2`,
        [projectId, user.id, JSON.stringify([{ id, name: file.name, mimeType: file.type, size: bytes.length, url: `/api/assets/${id}` }])],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({
      asset: { id, name: file.name, mimeType: file.type, size: bytes.length, url: `/api/assets/${id}` },
    }, { status: 201 });
  } catch {
    if (storageKey) await assetStorageProvider().delete(storageKey, user.id).catch(() => undefined);
    return NextResponse.json({ error: "MEDIA_PERSISTENCE_FAILED" }, { status: 503 });
  }
}

function hasValidSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 &&
      bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  }
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  }
  if (mimeType === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp";
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
