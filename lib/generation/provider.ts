import type { GenerationConfiguration, GeneratedAsset, GenerationJob } from "@/types/application";

export interface GenerationCapabilities {
  imageGeneration: boolean;
  videoGeneration: boolean;
  imageToVideo: boolean;
  videoToVideo: boolean;
  lora: boolean;
  multipleLoras: boolean;
  supportedDurations?: number[];
  supportedResolutions?: Array<{ width: number; height: number }>;
  seed: boolean;
  referenceImage: boolean;
}

export interface GenerationProvider {
  id: string;
  displayName: string;
  capabilities: GenerationCapabilities;
  generate(configuration: GenerationConfiguration): Promise<GenerationJob>;
  getAsset(jobId: string): Promise<GeneratedAsset | null>;
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
