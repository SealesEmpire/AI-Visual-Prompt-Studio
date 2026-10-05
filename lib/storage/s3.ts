import "server-only";
import {
  GetObjectCommand,
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
  };
}

function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
