import type { ProviderCapabilities } from "@/lib/providers/registry";

export type SupportedGenerationOperation =
  | "image_generation"
  | "image_editing"
  | "text_to_video"
  | "image_to_video"
  | "video_to_video";

export type CapabilityVerificationStatus =
  | "DECLARED"
  | "VERIFIED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface ModelCapabilityRecord {
  providerId: string;
  modelId: string;
  adapterVersion: string;
  capabilityVersion: string;
  supportedOperations: SupportedGenerationOperation[] | null;
  inputFormats: string[] | null;
  outputFormats: string[] | null;
  maximumReferenceCount: number | null;
  allowedDimensions: string[] | null;
  allowedDurations: number[] | null;
  supportsSeed: boolean | null;
  supportsMask: boolean | null;
  supportsNegativePrompt: boolean | null;
  supportsLora: boolean | null;
  verifiedAt: string | null;
  verificationStatus: CapabilityVerificationStatus;
}

export function createModelCapabilityRecord(input: {
  providerId: string;
  modelId: string;
  adapterVersion: string;
  capabilities: ProviderCapabilities | null;
  verificationStatus: CapabilityVerificationStatus;
  inputFormats?: string[] | null;
  outputFormats?: string[] | null;
  maximumReferenceCount?: number | null;
  allowedDimensions?: string[] | null;
  allowedDurations?: number[] | null;
  supportsMask?: boolean | null;
  verifiedAt?: string | null;
}): ModelCapabilityRecord {
  if (!input.providerId || !input.modelId || !input.adapterVersion) {
    throw new Error("MODEL_CAPABILITY_IDENTITY_REQUIRED");
  }
  if (
    input.verificationStatus === "VERIFIED" &&
    (!input.verifiedAt || !Number.isFinite(Date.parse(input.verifiedAt)))
  ) {
    throw new Error("VERIFIED_CAPABILITY_REQUIRES_TIMESTAMP");
  }

  const capabilities = input.capabilities;
  return {
    providerId: input.providerId,
    modelId: input.modelId,
    adapterVersion: input.adapterVersion,
    capabilityVersion: "1.0",
    supportedOperations: capabilities
      ? operations.filter((operation) => capabilities[operation.key]).map((operation) => operation.name)
      : null,
    inputFormats: input.inputFormats ?? null,
    outputFormats: input.outputFormats ?? null,
    maximumReferenceCount: input.maximumReferenceCount ?? null,
    allowedDimensions: input.allowedDimensions ?? capabilities?.supportedResolutions ?? null,
    allowedDurations: input.allowedDurations ?? capabilities?.supportedDurations ?? null,
    supportsSeed: capabilities?.seed ?? null,
    supportsMask: input.supportsMask ?? null,
    supportsNegativePrompt: capabilities?.negativePrompt ?? null,
    supportsLora: capabilities?.lora ?? null,
    verifiedAt: input.verificationStatus === "VERIFIED" ? input.verifiedAt! : null,
    verificationStatus: input.verificationStatus,
  };
}

const operations: Array<{
  key: keyof Pick<
    ProviderCapabilities,
    "imageGeneration" | "imageEditing" | "textToVideo" | "imageToVideo" | "videoToVideo"
  >;
  name: SupportedGenerationOperation;
}> = [
  { key: "imageGeneration", name: "image_generation" },
  { key: "imageEditing", name: "image_editing" },
  { key: "textToVideo", name: "text_to_video" },
  { key: "imageToVideo", name: "image_to_video" },
  { key: "videoToVideo", name: "video_to_video" },
];
