import type { GenerationConfiguration, GeneratedAsset, GenerationJob } from "@/types/application";

export interface ProviderCapabilities {
  imageGeneration: boolean;
  imageEditing: boolean;
  textToVideo: boolean;
  imageToVideo: boolean;
  videoToVideo: boolean;
  lora: boolean;
  multipleLoras: boolean;
  seed: boolean;
  negativePrompt: boolean;
  referenceImage: boolean;
  supportedDurations?: number[];
  supportedAspectRatios?: string[];
  supportedResolutions?: string[];
  supportedModels?: string[];
}

export type ProviderStatus = "CONFIGURED" | "AVAILABLE" | "UNAVAILABLE" | "ERROR" | "NOT CONFIGURED";

export interface ProviderHealth {
  id: string;
  displayName: string;
  configured: boolean;
  available: boolean | null;
  status: ProviderStatus;
  capabilities: ProviderCapabilities | null;
  models?: string[];
  installedPresetIds?: string[];
  capabilitySource?: "provider_discovery" | "operator_configuration" | "unknown";
  checkedAt?: string;
  error?: string;
}

export interface GenerationProvider {
  id: string;
  displayName: string;
  capabilities: ProviderCapabilities;
  generate(
    configuration: GenerationConfiguration,
    context?: { ownerId: string },
  ): Promise<GenerationJob>;
  getJobStatus?(
    providerJobId: string,
    context?: { ownerId: string; configuration: GenerationConfiguration },
  ): Promise<GenerationJob>;
  cancel?(providerJobId: string): Promise<void>;
  discover?(): Promise<Pick<ProviderHealth, "available" | "capabilities" | "models" | "installedPresetIds">>;
  getAsset?(jobId: string): Promise<GeneratedAsset | null>;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, GenerationProvider>();

  register(provider: GenerationProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): GenerationProvider | undefined {
    return this.providers.get(providerId);
  }

  getDefault(): GenerationProvider | undefined {
    return this.providers.values().next().value;
  }

  list(): GenerationProvider[] {
    return [...this.providers.values()];
  }
}

export const providerRegistry = new ProviderRegistry();

export function registerProvider(provider: GenerationProvider): void {
  providerRegistry.register(provider);
}

export const unknownProviderCapabilities: ProviderCapabilities = {
  imageGeneration: false,
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
