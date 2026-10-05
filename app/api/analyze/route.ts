import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import {
  openAIConfigurationFromEnvironment,
  OpenAIVisualAnalysisProvider,
} from "@/lib/providers/openai";
import { isSupportedMediaType } from "@/lib/media/file-types";
import { getPostgresPool } from "@/lib/database/postgres";

const maxImageBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
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
    typeof input.mimeType !== "string" ||
    (input.assetId !== undefined && typeof input.assetId !== "string")
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
    if (typeof input.assetId === "string") {
      const pool = getPostgresPool();
      if (!pool) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
      const source = await pool.query(
        "SELECT id, mime_type FROM media_assets WHERE id = $1 AND owner_id = $2 AND type = 'image'",
        [input.assetId, user.id],
      );
      if (!source.rows[0] || source.rows[0].mime_type !== input.mimeType) {
        return NextResponse.json({ error: "SOURCE_ASSET_NOT_FOUND" }, { status: 404 });
      }
    }
    const analysis = await new OpenAIVisualAnalysisProvider(config).analyzeImage({
      dataUrl: input.dataUrl,
    });
    if (typeof input.assetId === "string") {
      const pool = getPostgresPool()!;
      await pool.query(
        "INSERT INTO visual_analyses (owner_id, media_asset_id, analysis) VALUES ($1, $2, $3::jsonb)",
        [user.id, input.assetId, JSON.stringify(analysis)],
      );
    }
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
