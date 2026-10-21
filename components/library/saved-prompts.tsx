"use client";

import { useEffect, useState } from "react";
import { browserPromptRepository } from "@/lib/storage/browser-prompts";
import type { PromptArtifact } from "@/types/application";

export function SavedPrompts() {
  const [prompts, setPrompts] = useState<PromptArtifact[]>([]);

  useEffect(() => {
    void Promise.all([
      browserPromptRepository.list(),
      fetch("/api/prompts", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return [];
          const result = await response.json() as { prompts?: PromptArtifact[] };
          return result.prompts ?? [];
        })
        .catch(() => []),
    ]).then(([local, remote]) => {
      const combined = new Map<string, PromptArtifact>();
      for (const prompt of [...local, ...remote]) combined.set(prompt.id, prompt);
      setPrompts([...combined.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    });
  }, []);

  if (!prompts.length) {
    return <div className="empty-state panel"><span className="empty-state-icon">▤</span><p className="eyebrow">YOUR LIBRARY</p><h2>Nothing saved yet.</h2><p>Save a prompt from the Create workspace and it will appear here in this browser.</p></div>;
  }

  return (
    <div className="saved-prompt-list">
      {prompts.map((item) => (
        <article key={item.id} className="panel saved-prompt-card">
          <div className="saved-prompt-top"><span className="eyebrow">PROMPT · {new Date(item.createdAt).toLocaleDateString()}</span><span className="local-label">BROWSER SAVED</span></div>
          {item.goal && <p className="saved-goal">{item.goal}</p>}
          <p className="saved-prompt-text">{item.prompt}</p>
        </article>
      ))}
    </div>
  );
}
