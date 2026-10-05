"use client";

import { useEffect, useState } from "react";
import { browserPromptRepository } from "@/lib/storage/browser-prompts";
import type { PromptArtifact } from "@/types/application";

export function SavedPrompts() {
  const [prompts, setPrompts] = useState<PromptArtifact[]>([]);

  useEffect(() => {
    void browserPromptRepository.list().then(setPrompts);
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
