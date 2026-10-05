import {
  presetCatalog,
  type PresetVariant,
} from "../presets/registry.ts";
import type { MediaAsset, MediaKind } from "../../types/application.ts";

export interface NormalizedGenerationRequest {
  projectId?: string;
  mediaType: MediaKind;
  prompt: string;
  negativePrompt?: string;
  providerId?: string;
  modelId?: string;
  presetIds: string[];
  presetVariants?: Record<string, PresetVariant>;
  presetStrengths?: Record<string, number>;
  seed?: number;
  aspectRatio?: "16:9" | "1:1" | "9:16";
  width?: number;
  height?: number;
  duration?: number;
  referenceAsset?: MediaAsset;
}

export class GenerationRequestBuilder {
  build(input: unknown): NormalizedGenerationRequest {
    if (!isRecord(input)) throw new Error("Invalid generation request");
    if (
      (input.mediaType !== "image" && input.mediaType !== "video") ||
      typeof input.prompt !== "string" ||
      !input.prompt.trim() ||
      input.prompt.length > 20_000 ||
      !Array.isArray(input.presetIds) ||
      input.presetIds.length > 8 ||
      input.presetIds.some((id) => typeof id !== "string" || id.length > 200)
    ) {
      throw new Error("Invalid generation request");
    }

    const presetIds = [...new Set(input.presetIds as string[])];
    const presets = new Map(presetCatalog.map((preset) => [preset.id, preset]));
    const selectedPresets = presetIds.map((id) => {
      const preset = presets.get(id);
      if (!preset) throw new Error(`Unknown preset: ${id}`);
      if (preset.mediaType !== "both" && preset.mediaType !== input.mediaType) {
        throw new Error(`Preset ${id} is incompatible with ${input.mediaType} generation`);
      }
      if (!preset.enabled) throw new Error(`Preset ${id} is disabled`);
      return preset;
    });

    const suppliedVariants = parseRecordOfVariants(input.presetVariants);
    const presetVariants: Record<string, PresetVariant> = Object.fromEntries(
      selectedPresets
        .filter((preset) => preset.variant)
        .map((preset) => [preset.id, preset.variant!]),
    );
    for (const [id, variant] of Object.entries(suppliedVariants ?? {})) {
      const selected = selectedPresets.find((preset) => preset.id === id);
      if (!selected || selected.variant !== variant) {
        throw new Error(`Invalid variant for preset: ${id}`);
      }
      presetVariants[id] = variant;
    }

    const presetStrengths = parseRecordOfNumbers(input.presetStrengths);
    for (const [id, strength] of Object.entries(presetStrengths ?? {})) {
      const selected = selectedPresets.find((preset) => preset.id === id);
      if (
        !selected ||
        selected.minStrength === undefined ||
        selected.maxStrength === undefined ||
        strength < selected.minStrength ||
        strength > selected.maxStrength
      ) {
        throw new Error(`Strength is not configured for preset: ${id}`);
      }
    }

    const request: NormalizedGenerationRequest = {
      ...(optionalUuid(input.projectId, "projectId")),
      mediaType: input.mediaType,
      prompt: input.prompt.trim(),
      presetIds,
      ...(optionalString(input.negativePrompt, "negativePrompt", 10_000)),
      ...(optionalString(input.providerId, "providerId")),
      ...(optionalString(input.modelId, "modelId")),
      ...(Object.keys(presetVariants).length > 0 ? { presetVariants } : {}),
      ...(presetStrengths ? { presetStrengths } : {}),
      ...(optionalInteger(input.seed, "seed")),
      ...(optionalAspectRatio(input.aspectRatio)),
      ...(optionalInteger(input.width, "width", 1, 16_384)),
      ...(optionalInteger(input.height, "height", 1, 16_384)),
      ...(optionalPositiveNumber(input.duration, "duration", 3_600)),
      ...(parseReferenceAsset(input.referenceAsset)),
    };
    return request;
  }
}

export const generationRequestBuilder = new GenerationRequestBuilder();

function optionalUuid(value: unknown, field: string): Record<string, string> | Record<never, never> {
  if (value === undefined) return {};
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return { [field]: value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  field: string,
  maximum = 200,
): Record<string, string> | Record<never, never> {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length > maximum) throw new Error(`Invalid ${field}`);
  return { [field]: value };
}

function optionalInteger(
  value: unknown,
  field: string,
  minimum = 0,
  maximum = 16_384,
): Record<string, number> | Record<never, never> {
  if (value === undefined) return {};
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`Invalid ${field}`);
  }
  return { [field]: value as number };
}

function optionalPositiveNumber(
  value: unknown,
  field: string,
  maximum: number,
): Record<string, number> | Record<never, never> {
  if (value === undefined) return {};
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error(`Invalid ${field}`);
  }
  return { [field]: value };
}

function optionalAspectRatio(
  value: unknown,
): Record<string, "16:9" | "1:1" | "9:16"> | Record<never, never> {
  if (value === undefined) return {};
  if (value !== "16:9" && value !== "1:1" && value !== "9:16") {
    throw new Error("Invalid aspectRatio");
  }
  return { aspectRatio: value };
}

function parseRecordOfVariants(
  value: unknown,
): Record<string, PresetVariant> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Invalid presetVariants");
  const variants: Record<string, PresetVariant> = {};
  for (const [id, variant] of Object.entries(value)) {
    if (variant !== "high" && variant !== "low" && variant !== "standard") {
      throw new Error(`Invalid variant for preset: ${id}`);
    }
    variants[id] = variant;
  }
  return variants;
}

function parseRecordOfNumbers(
  value: unknown,
): Record<string, number> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Invalid presetStrengths");
  const strengths: Record<string, number> = {};
  for (const [id, strength] of Object.entries(value)) {
    if (typeof strength !== "number" || !Number.isFinite(strength)) {
      throw new Error(`Invalid strength for preset: ${id}`);
    }
    strengths[id] = strength;
  }
  return strengths;
}

function parseReferenceAsset(
  value: unknown,
): Record<string, MediaAsset> | Record<never, never> {
  if (value === undefined) return {};
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.mimeType !== "string" ||
    typeof value.size !== "number"
  ) {
    throw new Error("Invalid referenceAsset");
  }
  return { referenceAsset: value as unknown as MediaAsset };
}
