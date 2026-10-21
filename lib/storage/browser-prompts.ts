import type { PromptArtifact } from "@/types/application";

const key = "frame:saved-prompts:v1";

export const browserPromptRepository = {
  async list() {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value as PromptArtifact[] : [];
    } catch {
      return [];
    }
  },
  async save(prompt: PromptArtifact) {
    const prompts = await this.list();
    localStorage.setItem(key, JSON.stringify([prompt, ...prompts.filter((item) => item.id !== prompt.id)]));
  },
};
