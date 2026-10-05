import "server-only";
import {
  openAIConfigurationFromEnvironment,
  openAIProviderHealth,
  OpenAIImageGenerationProvider,
} from "@/lib/providers/openai";
import {
  runPodConfigurationFromEnvironment,
  runPodNotConfiguredHealth,
  RunPodWanProvider,
} from "@/lib/providers/runpod";
import {
  ProviderRegistry,
  type ProviderHealth,
} from "@/lib/providers/registry";

export function configuredProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const openAI = openAIConfigurationFromEnvironment();
  if (openAI?.imageModel) registry.register(new OpenAIImageGenerationProvider(openAI));
  const runPod = runPodConfigurationFromEnvironment();
  if (runPod) registry.register(new RunPodWanProvider(runPod));
  return registry;
}

export async function discoverProviderHealth(): Promise<ProviderHealth[]> {
  const openAI = openAIConfigurationFromEnvironment();
  const runPod = runPodConfigurationFromEnvironment();
  const results: ProviderHealth[] = [];

  if (openAI) {
    results.push(await openAIProviderHealth(openAI));
  } else {
    results.push({
      id: "openai",
      displayName: "OpenAI",
      configured: false,
      available: null,
      status: "NOT CONFIGURED",
      capabilities: null,
    });
  }

  if (runPod) {
    const provider = new RunPodWanProvider(runPod);
    try {
      const discovery = await provider.discover();
      results.push({
        id: provider.id,
        displayName: provider.displayName,
        configured: true,
        available: discovery.available,
        status: discovery.available ? "AVAILABLE" : "UNAVAILABLE",
        capabilities: discovery.capabilities,
        capabilitySource: "operator_configuration",
        models: discovery.models,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      results.push({
        id: provider.id,
        displayName: provider.displayName,
        configured: true,
        available: false,
        status: "ERROR",
        capabilities: null,
        checkedAt: new Date().toISOString(),
        error: "RunPod endpoint health check failed.",
      });
    }
  } else {
    results.push(runPodNotConfiguredHealth());
  }
  return results;
}
