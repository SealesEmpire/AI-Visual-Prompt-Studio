import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { PostgresPromptRepository } from "@/lib/storage/prompt-repository";
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
      (body.goal !== undefined && (typeof body.goal !== "string" || body.goal.length > 2_000))) {
    return NextResponse.json({ error: "INVALID_PROMPT_ARTIFACT" }, { status: 400 });
  }
  const prompt: PromptArtifact = {
    id: body.id,
    prompt: body.prompt.trim(),
    createdAt: new Date(body.createdAt).toISOString(),
    ...(typeof body.goal === "string" ? { goal: body.goal } : {}),
  };
  try {
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
