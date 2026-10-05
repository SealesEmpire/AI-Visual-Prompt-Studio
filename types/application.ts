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
  projectId?: string;
  sourceAssetId?: string;
  prompt: string;
  goal?: string;
  createdAt: string;
  analysis?: VisualAnalysis;
  editingIntent?: {
    preserve: string[];
    change: string[];
    add: string[];
    remove: string[];
    style: string[];
    finalResult: string;
  };
}

export interface GenerationConfiguration {
  projectId?: string;
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
  status:
    | "PENDING"
    | "QUEUED"
    | "SUBMITTING"
    | "GENERATING"
    | "PROCESSING"
    | "COMPLETE"
    | "FAILED"
    | "CANCELLED";
  configuration: GenerationConfiguration;
  createdAt: string;
  updatedAt?: string;
  providerId?: string;
  providerJobId?: string;
  progress?: number;
  retryCount?: number;
  error?: string;
  resultAsset?: GeneratedAsset;
}

export interface GeneratedAsset extends MediaAsset {
  projectId?: string;
  jobId: string;
  storageKey?: string;
  checksum?: string;
  createdAt?: string;
  configuration: GenerationConfiguration;
}

export interface VisualAnalysis {
  mediaType: MediaKind;
  summary: string;
  subjects: string[];
  environment?: string;
  composition?: string;
  camera?: string;
  lighting?: string;
  color?: string;
  style?: string;
  mood?: string;
  motion?: string;
  continuity?: string[];
  observations: string[];
}
