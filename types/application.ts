import type { PresetVariant } from "@/lib/presets/registry";

export type MediaKind = "image" | "video";

export interface MediaAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface PromptArtifact {
  id: string;
  prompt: string;
  goal?: string;
  createdAt: string;
}

export interface GenerationConfiguration {
  prompt: string;
  negativePrompt?: string;
  mediaType: MediaKind;
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

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: MediaAsset[];
  prompts: PromptArtifact[];
  generationConfigurations: GenerationConfiguration[];
}

export interface GenerationJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  configuration: GenerationConfiguration;
  createdAt: string;
  error?: string;
}

export interface GeneratedAsset extends MediaAsset {
  jobId: string;
  configuration: GenerationConfiguration;
}
