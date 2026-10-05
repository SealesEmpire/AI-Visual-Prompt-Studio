import "server-only";
import type { GenerationConfiguration, GenerationJob } from "@/types/application";
import type {
  GenerationProvider,
  ProviderCapabilities,
  ProviderHealth,
} from "@/lib/providers/registry";
import { createHash } from "node:crypto";
import { assetStorageProvider } from "@/lib/storage/s3";

export interface RunPodConfiguration {
  apiKey: string;
  endpointId: string;
  inputTemplate: Record<string, unknown>;
  capabilities: ProviderCapabilities;
  assetHosts: string[];
  installedPresetIds: string[];
}

export class RunPodWanProvider implements GenerationProvider {
  readonly id = "runpod-wan";
  readonly displayName = "RunPod WAN";

  constructor(private readonly config: RunPodConfiguration) {}

  get capabilities(): ProviderCapabilities {
    return this.config.capabilities;
  }

  async discover(): Promise<Pick<ProviderHealth, "available" | "capabilities" | "models">> {
    const response = await this.fetchEndpoint("/health", { method: "GET" });
    if (!response.ok) {
      return { available: false, capabilities: this.capabilities };
    }
    return {
      available: true,
      capabilities: this.capabilities,
      installedPresetIds: this.config.installedPresetIds,
      ...(this.capabilities.supportedModels
        ? { models: this.capabilities.supportedModels }
        : {}),
    };
  }

  async generate(
    configuration: GenerationConfiguration,
    context?: { ownerId: string; jobId?: string },
  ): Promise<GenerationJob> {
    if (!context?.ownerId) throw new Error("AUTHENTICATED_OWNER_REQUIRED");
    if (!this.supports(configuration)) throw new Error("PROVIDER_CAPABILITY_UNAVAILABLE");
    const input = substituteTemplate(this.config.inputTemplate, configuration);
    const response = await this.fetchEndpoint("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(`RUNPOD_SUBMISSION_HTTP_${response.status}`);
    if (!isRecord(data) || typeof data.id !== "string") {
      throw new Error("RUNPOD_INVALID_SUBMISSION");
    }
    return {
      id: context.jobId ?? crypto.randomUUID(),
      status: mapRunPodStatus(data.status),
      providerId: this.id,
      providerJobId: data.id,
      configuration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(typeof data.progress === "number" && Number.isFinite(data.progress)
        ? { progress: Math.max(0, Math.min(100, data.progress)) }
        : {}),
    };
  }

  async getJobStatus(
    providerJobId: string,
    context?: { ownerId: string; configuration: GenerationConfiguration },
  ): Promise<GenerationJob> {
    const response = await this.fetchEndpoint(`/status/${encodeURIComponent(providerJobId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(`RUNPOD_STATUS_HTTP_${response.status}`);
    if (!isRecord(data)) throw new Error("RUNPOD_INVALID_STATUS");
    const status = mapRunPodStatus(data.status);
    const resultAsset = status === "COMPLETE" && context?.ownerId && context.configuration
      ? await storeRunPodResult(data.output, providerJobId, context, this.config.assetHosts)
      : undefined;
    return {
      id: providerJobId,
      status: status === "COMPLETE" && !resultAsset ? "PROCESSING" : status,
      providerId: this.id,
      providerJobId,
      configuration: context?.configuration ?? emptyConfiguration(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(resultAsset ? { resultAsset } : {}),
      ...(typeof data.progress === "number" && Number.isFinite(data.progress)
        ? { progress: Math.max(0, Math.min(100, data.progress)) }
        : {}),
      ...(data.error && typeof data.error === "string"
        ? { error: sanitizeProviderError(data.error) }
        : {}),
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const response = await this.fetchEndpoint("/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: providerJobId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`RUNPOD_CANCEL_HTTP_${response.status}`);
  }

  private supports(configuration: GenerationConfiguration): boolean {
    return configuration.mediaType === "video"
      ? configuration.referenceAsset
        ? this.capabilities.imageToVideo
        : this.capabilities.textToVideo
      : this.capabilities.imageGeneration;
  }

  private fetchEndpoint(path: string, init: RequestInit): Promise<Response> {
    const url = `https://api.runpod.ai/v2/${encodeURIComponent(this.config.endpointId)}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: "Bearer " + this.config.apiKey,
      },
    });
  }
}

export function runPodConfigurationFromEnvironment(): RunPodConfiguration | null {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const inputTemplate = process.env.RUNPOD_INPUT_TEMPLATE;
  const rawCapabilities = process.env.RUNPOD_CAPABILITIES_JSON;
  const rawInstalledPresets = process.env.RUNPOD_INSTALLED_PRESET_IDS_JSON;
  const assetHosts = (process.env.RUNPOD_ASSET_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean);
  if (!apiKey || !endpointId || !inputTemplate || !rawCapabilities || assetHosts.length === 0) return null;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(endpointId)) return null;
  let template: unknown;
  let capabilities: unknown;
  try {
    template = JSON.parse(inputTemplate);
    capabilities = JSON.parse(rawCapabilities);
  } catch {
    return null;
  }
  if (!isRecord(template) || !isRecord(capabilities)) return null;
  let installedPresetIds: unknown = [];
  try {
    installedPresetIds = rawInstalledPresets ? JSON.parse(rawInstalledPresets) : [];
  } catch {
    return null;
  }
  if (!Array.isArray(installedPresetIds) || installedPresetIds.some((id) => typeof id !== "string" || id.length > 200)) return null;
  const capabilityKeys = [
    "imageGeneration",
    "imageEditing",
    "textToVideo",
    "imageToVideo",
    "videoToVideo",
    "lora",
    "multipleLoras",
    "seed",
    "negativePrompt",
    "referenceImage",
  ] as const;
  if (capabilityKeys.some((key) => typeof capabilities[key] !== "boolean")) return null;
  for (const key of ["supportedModels", "supportedAspectRatios", "supportedResolutions"] as const) {
    if (capabilities[key] !== undefined && (
      !Array.isArray(capabilities[key]) ||
      capabilities[key].some((item) => typeof item !== "string")
    )) return null;
  }
  if (capabilities.supportedDurations !== undefined && (
    !Array.isArray(capabilities.supportedDurations) ||
    capabilities.supportedDurations.some((duration) => typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0)
  )) return null;
  if (capabilities.multipleLoras === true && capabilities.lora !== true) return null;
  return {
    apiKey,
    endpointId,
    inputTemplate: template,
    assetHosts,
    installedPresetIds,
    capabilities: capabilities as unknown as ProviderCapabilities,
  };
}

export function runPodNotConfiguredHealth(): ProviderHealth {
  const hasPartialConfiguration = Boolean(
    process.env.RUNPOD_API_KEY ||
    process.env.RUNPOD_ENDPOINT_ID ||
    process.env.RUNPOD_INPUT_TEMPLATE ||
    process.env.RUNPOD_CAPABILITIES_JSON,
  );
  return {
    id: "runpod-wan",
    displayName: "RunPod WAN",
    configured: false,
    available: null,
    status: hasPartialConfiguration ? "ERROR" : "NOT CONFIGURED",
    capabilities: null,
    error: hasPartialConfiguration ? "RunPod endpoint configuration is incomplete or invalid." : undefined,
  };
}

export function substituteTemplate(
  template: Record<string, unknown>,
  configuration: GenerationConfiguration,
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    prompt: configuration.prompt,
    negativePrompt: configuration.negativePrompt ?? "",
    model: configuration.modelId ?? "",
    seed: configuration.seed,
    width: configuration.width,
    height: configuration.height,
    duration: configuration.duration,
    presetIds: configuration.presetIds,
    presetVariants: configuration.presetVariants ?? {},
    presetStrengths: configuration.presetStrengths ?? {},
    referenceAsset: configuration.referenceAsset,
  };
  return replacePlaceholders(template, values) as Record<string, unknown>;
}

function replacePlaceholders(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value === "string" && /^\{\{[a-zA-Z]+}}$/.test(value)) {
    const key = value.slice(2, -2);
    if (!(key in values)) throw new Error("RUNPOD_TEMPLATE_UNKNOWN_PLACEHOLDER");
    return values[key];
  }
  if (Array.isArray(value)) return value.map((item) => replacePlaceholders(item, values));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePlaceholders(item, values)]));
  }
  return value;
}

function mapRunPodStatus(status: unknown): GenerationJob["status"] {
  if (typeof status !== "string") throw new Error("RUNPOD_INVALID_STATUS");
  switch (status.toUpperCase()) {
    case "IN_QUEUE":
    case "QUEUED":
      return "QUEUED";
    case "IN_PROGRESS":
      return "GENERATING";
    case "COMPLETED":
      return "COMPLETE";
    case "CANCELLED":
      return "CANCELLED";
    case "FAILED":
      return "FAILED";
    default:
      throw new Error("RUNPOD_UNKNOWN_STATUS");
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("RUNPOD_INVALID_RESPONSE");
  }
}

function sanitizeProviderError(error: string): string {
  return error.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 500);
}

async function storeRunPodResult(
  output: unknown,
  providerJobId: string,
  context: { ownerId: string; configuration: GenerationConfiguration },
  allowedHosts: string[],
) {
  if (!isRecord(output)) throw new Error("RUNPOD_OUTPUT_UNAVAILABLE");
  const candidate = findOutputUrl(output);
  if (!candidate) throw new Error("RUNPOD_OUTPUT_UNAVAILABLE");
  const url = new URL(candidate);
  if (
    url.protocol !== "https:" ||
    !allowedHosts.some((host) => url.hostname.toLowerCase() === host.toLowerCase())
  ) {
    throw new Error("RUNPOD_OUTPUT_HOST_NOT_ALLOWED");
  }
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`RUNPOD_ASSET_HTTP_${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase();
  if (!contentType || !isGeneratedMimeType(contentType, context.configuration.mediaType)) {
    throw new Error("RUNPOD_ASSET_TYPE_INVALID");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 500 * 1024 * 1024) throw new Error("RUNPOD_ASSET_TOO_LARGE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 500 * 1024 * 1024) {
    throw new Error("RUNPOD_ASSET_SIZE_INVALID");
  }
  const assetId = crypto.randomUUID();
  const storageKey = await assetStorageProvider().store({
    ownerId: context.ownerId,
    assetId,
    bytes,
    mimeType: contentType,
  });
  return {
    id: assetId,
    jobId: providerJobId,
    name: `${assetId}.${context.configuration.mediaType === "video" ? "mp4" : "png"}`,
    mimeType: contentType,
    size: bytes.length,
    storageKey,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    createdAt: new Date().toISOString(),
    configuration: context.configuration,
  };
}

function findOutputUrl(output: Record<string, unknown>): string | undefined {
  for (const key of ["video_url", "image_url", "url", "video", "image"]) {
    if (typeof output[key] === "string") return output[key];
  }
  for (const value of Object.values(output)) {
    if (Array.isArray(value)) {
      const nested = value.find((item) => typeof item === "string" && item.startsWith("https://"));
      if (typeof nested === "string") return nested;
    }
  }
  return undefined;
}

function isGeneratedMimeType(mimeType: string, mediaType: "image" | "video"): boolean {
  return mediaType === "video"
    ? mimeType === "video/mp4" || mimeType === "video/webm"
    : mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp";
}

function emptyConfiguration(): GenerationConfiguration {
  return { mediaType: "video", prompt: "", presetIds: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
