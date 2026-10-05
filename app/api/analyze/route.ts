import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import {
  openAIConfigurationFromEnvironment,
  OpenAIVisualAnalysisProvider,
} from "@/lib/providers/openai";
import { isSupportedMediaType } from "@/lib/media/file-types";

const maxImageBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await getAuthenticatedUser(request))) {
    return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  }
  const config = openAIConfigurationFromEnvironment();
  if (!config?.analysisModel) {
    return NextResponse.json({ error: "VISUAL_ANALYSIS_PROVIDER_NOT_CONFIGURED" }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxImageBytes * 1.4) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }

  let input: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > maxImageBytes * 1.4) {
      return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
    }
    input = JSON.parse(body) as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_ANALYSIS_REQUEST" }, { status: 400 });
  }

  if (
    !isRecord(input) ||
    typeof input.dataUrl !== "string" ||
    typeof input.mimeType !== "string"
  ) {
    return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  }
  if (input.mimeType.startsWith("video/")) {
    return NextResponse.json({ error: "VIDEO_ANALYSIS_NOT_CONFIGURED" }, { status: 501 });
  }
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(input.mimeType) ||
    !isSupportedMediaType(input.mimeType) ||
    !isMatchingImageDataUrl(input.dataUrl, input.mimeType)
  ) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  if (Buffer.byteLength(input.dataUrl) > maxImageBytes * 1.4) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }

  try {
    const analysis = await new OpenAIVisualAnalysisProvider(config).analyzeImage({
      dataUrl: input.dataUrl,
    });
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      { error: safeServiceError(error) },
      { status: 502 },
    );
  }
}

function isMatchingImageDataUrl(value: string, mimeType: string): boolean {
  return value.startsWith(`data:${mimeType};base64,`) &&
    /^[A-Za-z0-9+/]+=*$/.test(value.slice(value.indexOf(",") + 1));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeServiceError(error: unknown): string {
  if (!(error instanceof Error)) return "VISUAL_ANALYSIS_FAILED";
  if (error.message.startsWith("AI_PROVIDER_")) return error.message;
  if (error.message.includes("HTTP_")) return "VISUAL_ANALYSIS_PROVIDER_ERROR";
  return "VISUAL_ANALYSIS_FAILED";
}
