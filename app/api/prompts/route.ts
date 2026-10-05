import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresPromptRepository } from "@/lib/storage/prompt-repository";
import { getPostgresPool } from "@/lib/database/postgres";
import type { PromptArtifact } from "@/types/application";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  try {
    const prompts = await new PostgresPromptRepository().list(user.id);
    return NextResponse.json({ prompts });
  } catch {
    return NextResponse.json({ error: "PROMPT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_PROMPT_ARTIFACT" }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.id !== "string" || !isUuid(body.id) ||
      typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 20_000 ||
      typeof body.createdAt !== "string" || !Number.isFinite(Date.parse(body.createdAt)) ||
      (body.goal !== undefined && (typeof body.goal !== "string" || body.goal.length > 2_000)) ||
      (body.projectId !== undefined && (typeof body.projectId !== "string" || !isUuid(body.projectId))) ||
      (body.sourceAssetId !== undefined && (typeof body.sourceAssetId !== "string" || !isUuid(body.sourceAssetId)))) {
    return NextResponse.json({ error: "INVALID_PROMPT_ARTIFACT" }, { status: 400 });
  }
  const prompt: PromptArtifact = {
    id: body.id,
    ...(typeof body.projectId === "string" ? { projectId: body.projectId } : {}),
    ...(typeof body.sourceAssetId === "string" ? { sourceAssetId: body.sourceAssetId } : {}),
    prompt: body.prompt.trim(),
    createdAt: new Date(body.createdAt).toISOString(),
    ...(typeof body.goal === "string" ? { goal: body.goal } : {}),
  };
  try {
    const pool = getPostgresPool();
    if (!pool) throw new Error("DATABASE_NOT_CONFIGURED");
    if (prompt.projectId) {
      const result = await pool.query("SELECT id FROM projects WHERE id = $1 AND owner_id = $2", [prompt.projectId, user.id]);
      if (!result.rows[0]) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    if (prompt.sourceAssetId) {
      const result = await pool.query(
        "SELECT id FROM media_assets WHERE id = $1 AND owner_id = $2 AND ($3::uuid IS NULL OR project_id = $3)",
        [prompt.sourceAssetId, user.id, prompt.projectId ?? null],
      );
      if (!result.rows[0]) return NextResponse.json({ error: "SOURCE_ASSET_NOT_FOUND" }, { status: 404 });
    }
    await new PostgresPromptRepository().save(user.id, prompt);
    return NextResponse.json({ prompt }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "PROMPT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
