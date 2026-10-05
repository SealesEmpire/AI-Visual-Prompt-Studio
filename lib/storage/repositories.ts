import type { GenerationJob, Project, PromptArtifact } from "@/types/application";

export interface ProjectRepository {
  list(): Promise<Project[]>;
  save(project: Project): Promise<void>;
}

export interface PromptRepository {
  list(): Promise<PromptArtifact[]>;
  save(prompt: PromptArtifact): Promise<void>;
}

export interface GenerationHistoryRepository {
  list(): Promise<GenerationJob[]>;
  save(job: GenerationJob): Promise<void>;
}

export type AssetDestination = "device" | "app_library" | "my_basket";

export interface AssetDeliveryService {
  deliver(assetId: string, destination: AssetDestination): Promise<void>;
}

export interface StorageCapabilities {
  databaseConnected: boolean;
  appLibraryConnected: boolean;
  myBasketConnected: boolean;
}

export const storageCapabilities: StorageCapabilities = {
  databaseConnected: false,
  appLibraryConnected: false,
  myBasketConnected: false,
};
