import type { GenerationJob, Project, PromptArtifact } from "@/types/application";

export interface ProjectRepository {
  list(ownerId: string): Promise<Project[]>;
  save(ownerId: string, project: Project): Promise<void>;
}

export interface PromptRepository {
  list(ownerId: string): Promise<PromptArtifact[]>;
  save(ownerId: string, prompt: PromptArtifact): Promise<void>;
}

export interface GenerationHistoryRepository {
  list(ownerId: string): Promise<GenerationJob[]>;
  save(ownerId: string, job: GenerationJob): Promise<void>;
}

export type AssetDestination = "device" | "app_library" | "my_basket";

export interface AssetDeliveryService {
  deliver(ownerId: string, assetId: string, destination: AssetDestination): Promise<{ downloadUrl?: string }>;
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
