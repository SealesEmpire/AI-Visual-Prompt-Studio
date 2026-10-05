import "server-only";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface AssetStorageProvider {
  store(input: {
    ownerId: string;
    assetId: string;
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<string>;
  signedReadUrl(storageKey: string, ownerId: string): Promise<string>;
  testConnection(ownerId: string): Promise<void>;
  delete(storageKey: string, ownerId: string): Promise<void>;
}

export function assetStorageProvider(): AssetStorageProvider {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = process.env;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("ASSET_STORAGE_NOT_CONFIGURED");
  }
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
  });
  return {
    async store({ ownerId, assetId, bytes, mimeType }) {
      if (!isSafeIdentifier(ownerId) || !isSafeIdentifier(assetId)) {
        throw new Error("INVALID_ASSET_OWNER");
      }
      const key = `${ownerId}/${assetId}`;
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
        ServerSideEncryption: "AES256",
      }));
      return key;
    },
    async signedReadUrl(storageKey, ownerId) {
      const expectedPrefix = `${ownerId}/`;
      if (!isSafeIdentifier(ownerId) || !storageKey.startsWith(expectedPrefix)) {
        throw new Error("ASSET_NOT_FOUND");
      }
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
        { expiresIn: 300 },
      );
    },
    async testConnection(ownerId) {
      const assetId = `diagnostic-${crypto.randomUUID()}`;
      const key = `${ownerId}/${assetId}`;
      const bytes = Buffer.from("ai-visual-prompt-studio-storage-check");
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: "text/plain",
          ServerSideEncryption: "AES256",
        }));
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 });
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(bytes)) {
          throw new Error("STORAGE_READ_VERIFICATION_FAILED");
        }
      } finally {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      }
    },
    async delete(storageKey, ownerId) {
      if (!isSafeIdentifier(ownerId) || !storageKey.startsWith(`${ownerId}/`)) {
        throw new Error("ASSET_NOT_FOUND");
      }
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    },
  };
}

function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
