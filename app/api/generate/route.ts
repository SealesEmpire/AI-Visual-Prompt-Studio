import { NextResponse } from "next/server";
import { generationRequestBuilder } from "@/lib/generation/request-builder";
import { providerRegistry } from "@/lib/generation/provider";

export async function POST(request: Request) {
  let normalizedRequest;
  try {
    normalizedRequest = generationRequestBuilder.build(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid generation request" },
      { status: 400 },
    );
  }

  const provider = normalizedRequest.providerId
    ? providerRegistry.get(normalizedRequest.providerId)
    : providerRegistry.getDefault();
  if (!provider) {
    return NextResponse.json(
      { error: "GENERATION PROVIDER NOT CONFIGURED" },
      { status: 503 },
    );
  }
  const capability =
    normalizedRequest.mediaType === "image"
      ? provider.capabilities.imageGeneration
      : provider.capabilities.videoGeneration;
  if (!capability) {
    return NextResponse.json(
      { error: "SELECTED PROVIDER DOES NOT SUPPORT THIS MEDIA TYPE" },
      { status: 400 },
    );
  }

  try {
    const job = await provider.generate(normalizedRequest);
    return NextResponse.json({ job }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: "GENERATION REQUEST FAILED" },
      { status: 502 },
    );
  }
}
