import { NextResponse } from "next/server";
import { discoverProviderHealth } from "@/lib/providers/configured";
import { isAuthenticationConfigured } from "@/lib/auth/service";

export async function GET() {
  const providers = await discoverProviderHealth();
  return NextResponse.json({
    providers,
    authConfigured: isAuthenticationConfigured(),
    presetCatalog: {
      image: 67,
      video: 59,
      availability: "unknown_without_backend_discovery",
    },
  });
}
