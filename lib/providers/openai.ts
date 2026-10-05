import type {
  GenerationConfiguration,
  GeneratedAsset,
  GenerationJob,
  VisualAnalysis,
} from "@/types/application";
import type {
  GenerationProvider,
  ProviderCapabilities,
  ProviderHealth,
} from "@/lib/providers/registry";
import { createHash, randomUUID } from "node:crypto";
import { assetStorageProvider } from "@/lib/storage/s3";
import { validateGeneratedAsset } from "@/lib/media/generated-asset-validation";

const apiBase = "https://api.openai.com/v1";

export interface OpenAIConfiguration {
  apiKey: string;
  analysisModel?: string;
  promptModel?: string;
  imageModel?: string;
}

export interface VisualAnalysisProvider {
  analyzeImage(input: { dataUrl: string }): Promise<VisualAnalysis>;
}

export interface PromptArchitectInput {
  analysis?: VisualAnalysis;
  shortRequest: string;
  goal: string;
  outputType: "image" | "video";
  model?: string;
  presetId?: string;
  style?: string;
  aspectRatio?: string;
  hasSourceMedia: boolean;
}

export interface PromptArchitectResult {
  prompt: string;
  editingIntent?: {
    preserve: string[];
    change: string[];
    add: string[];
    remove: string[];
    style: string[];
    finalResult: string;
  };
}

export interface PromptArchitectService {
  build(input: PromptArchitectInput): Promise<PromptArchitectResult>;
}

export class OpenAIVisualAnalysisProvider implements VisualAnalysisProvider {
  constructor(private readonly config: OpenAIConfiguration) {}

  async analyzeImage({ dataUrl }: { dataUrl: string }): Promise<VisualAnalysis> {
    if (!this.config.analysisModel) throw new Error("VISUAL_ANALYSIS_MODEL_NOT_CONFIGURED");
    const result = await openAIJson(this.config, this.config.analysisModel, [
      {
        type: "text",
        text: "Analyze the visible image for visual production only. Never identify a real person. Return JSON with mediaType=image, summary, subjects (array), optional environment, composition, camera, lighting, color, style, mood, and observations (array). Do not infer requested edits from objects merely visible in the source.",
      },
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
    ]);
    return validateVisualAnalysis(result, "image");
  }
}

export class OpenAIPromptArchitect implements PromptArchitectService {
  constructor(private readonly config: OpenAIConfiguration) {}

  async build(input: PromptArchitectInput): Promise<PromptArchitectResult> {
    if (!this.config.promptModel) throw new Error("PROMPT_MODEL_NOT_CONFIGURED");
    const result = await openAIJson(this.config, this.config.promptModel, [
      {
        type: "text",
        text: [
          "Create one production-ready generation prompt. Return JSON with a non-empty prompt string.",
          "For image output, structure the result around objective, subject, requested changes, composition, environment, lighting, camera, color, materials, texture, style, mood, and output requirements.",
          "For video output, structure around objective, subject, action, environment, camera movement, framing, lighting, motion, pacing, continuity, style, and ending.",
          "When hasSourceMedia is true, also return editingIntent with string arrays preserve, change, add, remove, style, and a finalResult string.",
          "Only put explicit user-requested changes in change/add/remove. Do not treat merely visible source details as requested edits.",
          "Do not return analysis or chain-of-thought.",
        ].join(" "),
      },
      { type: "text", text: JSON.stringify(input) },
    ]);
    return validatePromptResult(result, input.hasSourceMedia);
  }
}

export class OpenAIImageGenerationProvider implements GenerationProvider {
  readonly id = "openai-image";
  readonly displayName = "OpenAI Images";
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: true,
    imageEditing: false,
    textToVideo: false,
    imageToVideo: false,
    videoToVideo: false,
    lora: false,
    multipleLoras: false,
    seed: false,
    negativePrompt: false,
    referenceImage: false,
  };

  constructor(private readonly config: OpenAIConfiguration) {}

  async discover(): Promise<Pick<ProviderHealth, "available" | "capabilities" | "models">> {
    const models = await listModels(this.config);
    const imageModel = this.config.imageModel;
    const available = Boolean(imageModel && models.includes(imageModel));
    return { available, capabilities: this.capabilities, models };
  }

  async generate(
    configuration: GenerationConfiguration,
    context?: { ownerId: string; jobId?: string },
  ): Promise<GenerationJob> {
    if (!this.config.imageModel) throw new Error("IMAGE_MODEL_NOT_CONFIGURED");
    if (configuration.mediaType !== "image") throw new Error("UNSUPPORTED_MEDIA_TYPE");
    if (!context?.ownerId) throw new Error("AUTHENTICATED_OWNER_REQUIRED");
    if (!assetStorageConfigured()) throw new Error("ASSET_STORAGE_NOT_CONFIGURED");
    const imageSize = mapImageSize(configuration.aspectRatio);
    const response = await fetch(`${apiBase}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.imageModel,
        prompt: configuration.prompt,
        size: imageSize,
        n: 1,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await response.json() as unknown;
    if (!response.ok) throw new Error(`IMAGE_PROVIDER_HTTP_${response.status}`);
    const encoded = getImageBase64(data);
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > 50 * 1024 * 1024) {
      throw new Error("IMAGE_PROVIDER_INVALID_ASSET");
    }
    await validateGeneratedAsset(bytes, "image/png", "image");
    const jobId = context.jobId ?? randomUUID();
    const storageKey = await assetStorageProvider().store({
      ownerId: context.ownerId,
      assetId: jobId,
      bytes,
      mimeType: "image/png",
    });
    const generated: GeneratedAsset = {
      id: jobId,
      jobId,
      name: `${jobId}.png`,
      mimeType: "image/png",
      size: bytes.length,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      storageKey,
      createdAt: new Date().toISOString(),
      configuration,
    };
    return {
      id: jobId,
      status: "COMPLETE",
      providerId: this.id,
      configuration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resultAsset: generated,
    };
  }
}

export function openAIConfigurationFromEnvironment(): OpenAIConfiguration | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL,
    promptModel: process.env.OPENAI_PROMPT_MODEL,
    imageModel: process.env.OPENAI_IMAGE_MODEL,
  };
}

export async function openAIProviderHealth(
  config: OpenAIConfiguration,
): Promise<ProviderHealth> {
  try {
    const models = await listModels(config);
    const configuredModels = [config.analysisModel, config.promptModel, config.imageModel].filter(
      (model): model is string => Boolean(model),
    );
    return {
      id: "openai",
      displayName: "OpenAI",
      configured: true,
      available: configuredModels.length > 0 && configuredModels.every((model) => models.includes(model)),
      status: configuredModels.length === 0 ? "CONFIGURED" : configuredModels.every((model) => models.includes(model)) ? "AVAILABLE" : "UNAVAILABLE",
      capabilities: {
        imageGeneration: Boolean(config.imageModel && models.includes(config.imageModel)),
        imageEditing: false,
        textToVideo: false,
        imageToVideo: false,
        videoToVideo: false,
        lora: false,
        multipleLoras: false,
        seed: false,
        negativePrompt: false,
        referenceImage: false,
      },
      capabilitySource: "provider_discovery",
      models,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id: "openai",
      displayName: "OpenAI",
      configured: true,
      available: false,
      status: "ERROR",
      capabilities: null,
      checkedAt: new Date().toISOString(),
      error: safeError(error),
    };
  }
}

async function openAIJson(
  config: OpenAIConfiguration,
  model: string,
  content: Array<Record<string, unknown>>,
): Promise<unknown> {
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (!response.ok) throw new Error(`AI_PROVIDER_HTTP_${response.status}`);
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("AI_PROVIDER_INVALID_RESPONSE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("AI_PROVIDER_INVALID_JSON");
  }
}

async function listModels(config: OpenAIConfiguration): Promise<string[]> {
  const response = await fetch(`${apiBase}/models`, {
    headers: { Authorization: "Bearer " + config.apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`AI_PROVIDER_HTTP_${response.status}`);
  const data = await response.json() as { data?: Array<{ id?: unknown }> };
  return Array.isArray(data.data)
    ? data.data.flatMap((model) => typeof model.id === "string" ? [model.id] : [])
    : [];
}

export async function testOpenAIConnection(apiKey: string): Promise<{ modelCount: number }> {
  const models = await listModels({ apiKey });
  if (models.length === 0) throw new Error("OPENAI_MODEL_DISCOVERY_EMPTY");
  return { modelCount: models.length };
}

export function validateVisualAnalysis(
  value: unknown,
  mediaType: "image" | "video" = "image",
): VisualAnalysis {
  if (!isRecord(value) || typeof value.summary !== "string" || value.summary.length > 4000 ||
      !isStringArray(value.subjects) || value.subjects.length > 100 ||
      !isStringArray(value.observations) || value.observations.length > 200) {
    throw new Error("AI_PROVIDER_INVALID_ANALYSIS");
  }
  const optionalFields = ["environment", "composition", "camera", "lighting", "color", "style", "mood", "motion"];
  for (const field of optionalFields) {
    if (value[field] !== undefined && (typeof value[field] !== "string" || value[field].length > 4000)) {
      throw new Error("AI_PROVIDER_INVALID_ANALYSIS");
    }
  }
  if (value.continuity !== undefined && (!isStringArray(value.continuity) || value.continuity.length > 100)) {
    throw new Error("AI_PROVIDER_INVALID_ANALYSIS");
  }
  return {
    mediaType,
    summary: value.summary,
    subjects: value.subjects,
    observations: value.observations,
    ...Object.fromEntries(optionalFields.filter((field) => typeof value[field] === "string").map((field) => [field, value[field]])),
    ...(value.continuity ? { continuity: value.continuity } : {}),
  } as VisualAnalysis;
}

function validatePromptResult(value: unknown, hasSourceMedia: boolean): PromptArchitectResult {
  if (!isRecord(value) || typeof value.prompt !== "string" || !value.prompt.trim() || value.prompt.length > 20_000) {
    throw new Error("AI_PROVIDER_INVALID_PROMPT");
  }
  if (!hasSourceMedia) return { prompt: value.prompt.trim() };
  if (!isRecord(value.editingIntent) ||
      !isStringArray(value.editingIntent.preserve) || value.editingIntent.preserve.length > 100 ||
      !isStringArray(value.editingIntent.change) || value.editingIntent.change.length > 100 ||
      !isStringArray(value.editingIntent.add) || value.editingIntent.add.length > 100 ||
      !isStringArray(value.editingIntent.remove) || value.editingIntent.remove.length > 100 ||
      !isStringArray(value.editingIntent.style) || value.editingIntent.style.length > 100 ||
      typeof value.editingIntent.finalResult !== "string" || value.editingIntent.finalResult.length > 4000) {
    throw new Error("AI_PROVIDER_INVALID_EDITING_INTENT");
  }
  return {
    prompt: value.prompt.trim(),
    editingIntent: {
      preserve: value.editingIntent.preserve,
      change: value.editingIntent.change,
      add: value.editingIntent.add,
      remove: value.editingIntent.remove,
      style: value.editingIntent.style,
      finalResult: value.editingIntent.finalResult,
    },
  };
}

function getImageBase64(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.data)) throw new Error("IMAGE_PROVIDER_INVALID_RESPONSE");
  const first = value.data[0];
  if (!isRecord(first) || typeof first.b64_json !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(first.b64_json) ||
      first.b64_json.length > 70_000_000 || first.b64_json.length % 4 !== 0) {
    throw new Error("IMAGE_PROVIDER_INVALID_RESPONSE");
  }
  return first.b64_json;
}

function mapImageSize(aspectRatio?: string): string {
  if (aspectRatio === "9:16") return "1024x1536";
  if (aspectRatio === "1:1" || !aspectRatio) return "1024x1024";
  return "1536x1024";
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, "[redacted]") : "Provider check failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function assetStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
    process.env.S3_REGION &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET,
  );
}
