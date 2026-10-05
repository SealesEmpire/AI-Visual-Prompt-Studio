import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/service";
import { generationRequestBuilder } from "@/lib/generation/request-builder";
import { PostgresGenerationJobRepository } from "@/lib/generation/job-repository";
import { configuredProviderRegistry } from "@/lib/providers/configured";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  let configuration;
  try {
    configuration = generationRequestBuilder.build(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid generation request" },
      { status: 400 },
    );
  }

  if (configuration.referenceAsset) {
    return NextResponse.json({ error: "REFERENCE_ASSET_NOT_UPLOADED" }, { status: 400 });
  }
  const providers = configuredProviderRegistry();
  const provider = configuration.providerId
    ? providers.get(configuration.providerId)
    : providers.list().find((candidate) =>
      configuration.mediaType === "image"
        ? candidate.capabilities.imageGeneration
        : configuration.referenceAsset
          ? candidate.capabilities.imageToVideo
          : candidate.capabilities.textToVideo,
    );
  if (!provider) {
    return NextResponse.json({ error: "GENERATION PROVIDER NOT CONFIGURED" }, { status: 503 });
  }
  const capability = configuration.mediaType === "image"
    ? provider.capabilities.imageGeneration
    : configuration.referenceAsset
      ? provider.capabilities.imageToVideo
      : provider.capabilities.textToVideo;
  if (!capability) {
    return NextResponse.json({ error: "SELECTED PROVIDER DOES NOT SUPPORT THIS WORKFLOW" }, { status: 400 });
  }
  if (configuration.presetIds.length && !provider.capabilities.lora) {
    return NextResponse.json({ error: "SELECTED PROVIDER DOES NOT SUPPORT PRESETS" }, { status: 400 });
  }
  if (configuration.presetIds.length &&
      (!provider.installedPresetIds ||
        configuration.presetIds.some((presetId) => !provider.installedPresetIds!.includes(presetId)))) {
    return NextResponse.json({ error: "PRESET_AVAILABILITY_UNKNOWN_OR_UNAVAILABLE" }, { status: 409 });
  }
  if (configuration.presetIds.length > 1 && !provider.capabilities.multipleLoras) {
    return NextResponse.json({ error: "SELECTED PROVIDER DOES NOT SUPPORT MULTIPLE PRESETS" }, { status: 400 });
  }
  if (configuration.seed !== undefined && !provider.capabilities.seed) {
    return NextResponse.json({ error: "SELECTED PROVIDER DOES NOT SUPPORT SEEDS" }, { status: 400 });
  }
  if (configuration.negativePrompt && !provider.capabilities.negativePrompt) {
    return NextResponse.json({ error: "SELECTED PROVIDER DOES NOT SUPPORT NEGATIVE PROMPTS" }, { status: 400 });
  }
  if (configuration.modelId && provider.capabilities.supportedModels &&
      !provider.capabilities.supportedModels.includes(configuration.modelId)) {
    return NextResponse.json({ error: "SELECTED_MODEL_UNAVAILABLE" }, { status: 400 });
  }
  if (configuration.aspectRatio && provider.capabilities.supportedAspectRatios &&
      !provider.capabilities.supportedAspectRatios.includes(configuration.aspectRatio)) {
    return NextResponse.json({ error: "SELECTED_ASPECT_RATIO_UNAVAILABLE" }, { status: 400 });
  }
  if (configuration.duration !== undefined && provider.capabilities.supportedDurations &&
      !provider.capabilities.supportedDurations.includes(configuration.duration)) {
    return NextResponse.json({ error: "SELECTED_DURATION_UNAVAILABLE" }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "AUTHENTICATION_NOT_CONFIGURED" }, { status: 503 });
  }
  const repository = new PostgresGenerationJobRepository();
  if (configuration.projectId) {
    const project = await (await import("@/lib/database/postgres")).getPostgresPool()?.query(
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
      [configuration.projectId, user.id],
    );
    if (!project?.rows[0]) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
  if (idempotencyKey && !/^[a-zA-Z0-9._:-]{1,200}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "INVALID_IDEMPOTENCY_KEY" }, { status: 400 });
  }
  const pending = {
    id,
    status: "QUEUED" as const,
    providerId: provider.id,
    configuration: { ...configuration, providerId: provider.id },
    createdAt,
    updatedAt: createdAt,
  };

  try {
    const limit = await checkRateLimit(user.id, "generation", 20, 3600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }
    const job = await repository.create(user.id, pending, idempotencyKey);
    return NextResponse.json({ job: safeJob(job) }, { status: job.id === id ? 202 : 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
      return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: "GENERATION_QUEUE_UNAVAILABLE" }, { status: 503 });
  }
}

function safeJob<T extends { error?: string; resultAsset?: unknown }>(job: T) {
  const { error, resultAsset, ...safe } = job;
  return {
    ...safe,
    ...(error ? { error: sanitizeError(error) } : {}),
    ...(resultAsset ? { resultAsset } : {}),
  };
}

function sanitizeError(error: string): string {
  return error.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 500);
}
