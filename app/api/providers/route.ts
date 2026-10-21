import { NextResponse } from "next/server";
import { discoverProviderHealth } from "@/lib/providers/configured";
import { isAuthenticationConfigured } from "@/lib/auth/service";
import { getPublicConfigurationStatus } from "@/lib/config/server-config";

export async function GET() {
  const providers = await discoverProviderHealth();
  return NextResponse.json({
    providers,
    authConfigured: isAuthenticationConfigured(),
    configuration: getPublicConfigurationStatus(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    assetStorageConfigured: Boolean(
      process.env.S3_ENDPOINT &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET,
    ),
    runpodEndpointId: process.env.RUNPOD_ENDPOINT_ID ?? null,
    presetCatalog: {
      image: 67,
      video: 59,
      availability: "unknown_without_backend_discovery",
    },
  });
}
