import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getPostgresPool } from "@/lib/database/postgres";
import { assetStorageProvider } from "@/lib/storage/s3";
import type { AssetDeliveryService, AssetDestination } from "@/lib/storage/repositories";

export class ConfiguredAssetDeliveryService implements AssetDeliveryService {
  async deliver(ownerId: string, assetId: string, destination: AssetDestination): Promise<{ downloadUrl?: string }> {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    const result = await pool.query(
      "SELECT storage_key FROM media_assets WHERE id = $1 AND owner_id = $2",
      [assetId, ownerId],
    );
    const storageKey: unknown = result.rows[0]?.storage_key;
    if (typeof storageKey !== "string") throw new Error("ASSET_NOT_FOUND");
    if (destination === "device") {
      return { downloadUrl: await assetStorageProvider().signedReadUrl(storageKey, ownerId) };
    }
    if (destination === "app_library") return {};
    if (destination === "my_basket") {
      await deliverToBasket(ownerId, assetId);
      return {};
    }
    throw new Error("ASSET_DESTINATION_UNSUPPORTED");
  }
}

export type BasketProvider = "s3_compatible" | "cloudflare_r2" | "digitalocean_spaces" | "backblaze_b2";
export interface BasketConnectionInput {
  provider: BasketProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface StoredConnection extends Omit<BasketConnectionInput, "accessKeyId" | "secretAccessKey"> {
  accessKeyId: string;
  secretAccessKey: string;
}

export async function testBasketConnection(connection: BasketConnectionInput): Promise<void> {
  validateConnection(connection);
  const client = getClient(connection);
  const key = `diagnostics/${randomUUID()}`;
  const bytes = Buffer.from("ai-visual-prompt-studio-my-basket-check");
  try {
    await client.send(new HeadBucketCommand({ Bucket: connection.bucket }));
    await client.send(new PutObjectCommand({ Bucket: connection.bucket, Key: key, Body: bytes, ContentType: "text/plain" }));
    await client.send(new HeadObjectCommand({ Bucket: connection.bucket, Key: key }));
    const downloaded = await client.send(new GetObjectCommand({ Bucket: connection.bucket, Key: key }));
    if (!downloaded.Body || !Buffer.from(await downloaded.Body.transformToByteArray()).equals(bytes)) {
      throw new Error("MY_BASKET_READ_VERIFICATION_FAILED");
    }
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: connection.bucket, Key: key })).catch(() => undefined);
  }
}

export async function saveBasketConnection(ownerId: string, input: BasketConnectionInput): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
  const { encrypted, iv, tag } = encryptCredentials(input.accessKeyId, input.secretAccessKey);
  await pool.query(
    `INSERT INTO user_storage_connections
      (owner_id, provider, endpoint, region, bucket, credentials_encrypted, credential_iv, credential_tag, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (owner_id) DO UPDATE
     SET provider = EXCLUDED.provider, endpoint = EXCLUDED.endpoint, region = EXCLUDED.region,
         bucket = EXCLUDED.bucket, credentials_encrypted = EXCLUDED.credentials_encrypted,
         credential_iv = EXCLUDED.credential_iv, credential_tag = EXCLUDED.credential_tag,
         updated_at = now()`,
    [ownerId, input.provider, input.endpoint, input.region, input.bucket, encrypted, iv, tag],
  );
}

export async function getBasketConnection(ownerId: string): Promise<StoredConnection | null> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
  const result = await pool.query(
    `SELECT provider, endpoint, region, bucket, credentials_encrypted, credential_iv, credential_tag
     FROM user_storage_connections WHERE owner_id = $1`,
    [ownerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const [accessKeyId, secretAccessKey] = decryptCredentials(
    row.credentials_encrypted,
    row.credential_iv,
    row.credential_tag,
  );
  return {
    provider: row.provider as BasketProvider,
    endpoint: row.endpoint,
    region: row.region,
    bucket: row.bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export async function deliverToBasket(ownerId: string, assetId: string): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
  const asset = await pool.query(
    "SELECT storage_key, mime_type FROM media_assets WHERE id = $1 AND owner_id = $2",
    [assetId, ownerId],
  );
  const row = asset.rows[0];
  if (!row || typeof row.storage_key !== "string") throw new Error("ASSET_NOT_FOUND");
  const connection = await getBasketConnection(ownerId);
  if (!connection) throw new Error("MY_BASKET_NOT_CONFIGURED");
  validateConnection(connection);
  const bytes = await assetStorageProvider().read(row.storage_key, ownerId);
  const extension = extensionForMime(row.mime_type);
  const destinationKey = `ai-visual-prompt-studio/${ownerId}/${assetId}.${extension}`;
  await getClient(connection).send(new PutObjectCommand({
    Bucket: connection.bucket,
    Key: destinationKey,
    Body: bytes,
    ContentType: row.mime_type,
  }));
}

function getClient(connection: BasketConnectionInput): S3Client {
  return new S3Client({
    endpoint: connection.endpoint,
    region: connection.region,
    forcePathStyle: connection.provider === "s3_compatible",
    credentials: { accessKeyId: connection.accessKeyId, secretAccessKey: connection.secretAccessKey },
  });
}

function encryptCredentials(accessKeyId: string, secretAccessKey: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify([accessKeyId, secretAccessKey]), "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptCredentials(encrypted: string, iv: string, tag: string): [string, string] {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed: unknown = JSON.parse(plaintext);
  if (!Array.isArray(parsed) || parsed.length !== 2 || parsed.some((value) => typeof value !== "string")) {
    throw new Error("MY_BASKET_CREDENTIALS_INVALID");
  }
  return parsed as [string, string];
}

function encryptionKey(): Buffer {
  const value = process.env.ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) throw new Error("ENCRYPTION_KEY_NOT_CONFIGURED");
  return Buffer.from(value, "hex");
}

function validateConnection(connection: BasketConnectionInput): void {
  if (!["s3_compatible", "cloudflare_r2", "digitalocean_spaces", "backblaze_b2"].includes(connection.provider) ||
      !connection.region || connection.region.length > 100 ||
      !/^[a-zA-Z0-9.-]{3,63}$/.test(connection.bucket) ||
      !connection.accessKeyId || connection.accessKeyId.length > 256 ||
      !connection.secretAccessKey || connection.secretAccessKey.length > 512) {
    throw new Error("MY_BASKET_CONFIGURATION_INVALID");
  }
  let url: URL;
  try {
    url = new URL(connection.endpoint);
  } catch {
    throw new Error("MY_BASKET_ENDPOINT_INVALID");
  }
  const host = url.hostname.toLowerCase();
  const validDomain =
    host.endsWith(".amazonaws.com") ||
    host.endsWith(".r2.cloudflarestorage.com") ||
    host.endsWith(".digitaloceanspaces.com") ||
    host.endsWith(".backblazeb2.com");
  const providerDomain = {
    s3_compatible: validDomain,
    cloudflare_r2: host.endsWith(".r2.cloudflarestorage.com"),
    digitalocean_spaces: host.endsWith(".digitaloceanspaces.com"),
    backblaze_b2: host.endsWith(".backblazeb2.com"),
  }[connection.provider];
  if (url.protocol !== "https:" || !providerDomain || (url.port && url.port !== "443") ||
      url.username || url.password || url.search || url.hash) {
    throw new Error("MY_BASKET_ENDPOINT_NOT_SUPPORTED");
  }
}

function extensionForMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  const extension = extensions[mimeType];
  if (!extension) throw new Error("ASSET_TYPE_UNSUPPORTED");
  return extension;
}
