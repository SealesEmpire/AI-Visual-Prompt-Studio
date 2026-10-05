import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import {
  OpenAIPromptArchitect,
  openAIConfigurationFromEnvironment,
  validateVisualAnalysis,
} from "@/lib/providers/openai";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const limit = await checkRateLimit(user.id, "prompt-build", 20, 3600);
    if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  } catch {
    return NextResponse.json({ error: "RATE_LIMIT_SERVICE_UNAVAILABLE" }, { status: 503 });
  }
  const config = openAIConfigurationFromEnvironment();
  if (!config?.promptModel) {
    return NextResponse.json({ error: "PROMPT_ARCHITECT_NOT_CONFIGURED" }, { status: 503 });
  }
  let input: unknown;
  try {
    input = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_PROMPT_REQUEST" }, { status: 400 });
  }
  if (!isRecord(input) || typeof input.shortRequest !== "string" || input.shortRequest.length > 4000 ||
      typeof input.goal !== "string" || input.goal.length > 2000 ||
      (input.outputType !== "image" && input.outputType !== "video") ||
      (input.hasSourceMedia !== undefined && typeof input.hasSourceMedia !== "boolean") ||
      (input.model !== undefined && typeof input.model !== "string") ||
      (input.presetId !== undefined && typeof input.presetId !== "string") ||
      (input.style !== undefined && typeof input.style !== "string") ||
      (input.aspectRatio !== undefined && typeof input.aspectRatio !== "string")) {
    return NextResponse.json({ error: "INVALID_PROMPT_REQUEST" }, { status: 400 });
  }

  let analysis;
  try {
    analysis = input.analysis === undefined
      ? undefined
      : validateVisualAnalysis(input.analysis);
  } catch {
    return NextResponse.json({ error: "INVALID_VISUAL_ANALYSIS" }, { status: 400 });
  }

  try {
    const prompt = await new OpenAIPromptArchitect(config).build({
      ...(analysis ? { analysis } : {}),
      shortRequest: input.shortRequest,
      goal: input.goal,
      outputType: input.outputType,
      ...(typeof input.model === "string" ? { model: input.model } : {}),
      ...(typeof input.presetId === "string" ? { presetId: input.presetId } : {}),
      ...(typeof input.style === "string" ? { style: input.style } : {}),
      ...(typeof input.aspectRatio === "string" ? { aspectRatio: input.aspectRatio } : {}),
      hasSourceMedia: input.hasSourceMedia === true,
    });
    return NextResponse.json({ prompt });
  } catch {
    return NextResponse.json({ error: "PROMPT_ARCHITECT_FAILED" }, { status: 502 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
