"use client";

import { useState } from "react";
import { MediaInput } from "@/components/media/media-input";
import { PresetSelector } from "@/components/presets/preset-browser";
import { browserPromptRepository } from "@/lib/storage/browser-prompts";
import type { MediaAsset, MediaKind, PromptArtifact } from "@/types/application";

type WorkspaceMode = "simple" | "pro";
type AspectRatio = "16:9" | "1:1" | "9:16";

const dimensions: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 720, height: 1280 },
};

export function CreateWorkspace() {
  const [mode, setMode] = useState<WorkspaceMode>("simple");
  const [mediaType, setMediaType] = useState<MediaKind>("image");
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [idea, setIdea] = useState("");
  const [goal, setGoal] = useState("");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [generationError, setGenerationError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function savePrompt() {
    if (!prompt.trim()) {
      setSavedMessage("Add a prompt before saving.");
      return;
    }
    const artifact: PromptArtifact = {
      id: crypto.randomUUID(),
      prompt: prompt.trim(),
      goal: goal.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      await browserPromptRepository.save(artifact);
      setSavedMessage("Saved in this browser’s Library.");
    } catch {
      setSavedMessage("Browser storage is unavailable.");
    }
  }

  async function generate() {
    setGenerationError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaType,
          prompt: prompt || idea,
          presetIds: presetId ? [presetId] : [],
          ...(mediaType === "image" ? dimensions[aspectRatio] : {}),
          ...(asset ? { referenceAsset: { id: asset.id, name: asset.name, mimeType: asset.mimeType, size: asset.size } } : {}),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) setGenerationError(result.error ?? "Generation request failed.");
      else setGenerationError("Generation request accepted. Job status is not yet connected to this workspace.");
    } catch {
      setGenerationError("Generation service is unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="create-layout">
      <section className="create-main">
        <div className="page-heading create-heading">
          <div><p className="eyebrow">CREATIVE WORKSPACE</p><h1>Make something<br className="mobile-break" /> <em>remarkable.</em></h1><p className="page-subtitle">Shape your idea into a prompt that’s ready to create.</p></div>
          <div className="mode-toggle" aria-label="Workspace mode">
            <button type="button" className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>Simple</button>
            <button type="button" className={mode === "pro" ? "active" : ""} onClick={() => setMode("pro")}>Pro</button>
          </div>
        </div>

        <section className="workflow-card panel">
          <div className="section-title-row"><div><span className="step-index">01</span><h2>Start with a reference</h2></div><span className="optional-label">OPTIONAL</span></div>
          <MediaInput asset={asset} onChange={setAsset} />
        </section>

        <section className="workflow-card panel">
          <div className="section-title-row"><div><span className="step-index">02</span><h2>Describe your vision</h2></div><span className="optional-label">YOUR IDEA</span></div>
          <label className="form-label" htmlFor="visual-idea">What would you like it to look like?</label>
          <textarea id="visual-idea" className="text-area idea-area" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="A cinematic still of a quiet cabin in the mountains at blue hour…" rows={3} />
          <label className="form-label goal-label" htmlFor="visual-goal">What are you trying to accomplish?</label>
          <input id="visual-goal" className="text-input" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. Create a cover image for my travel journal" />
          <button type="button" className={`analysis-toggle${analysisOpen ? " open" : ""}`} onClick={() => setAnalysisOpen(!analysisOpen)} aria-expanded={analysisOpen}>
            <span><span className="analysis-icon">◉</span><strong>Visual analysis</strong><small>{asset ? "Media analysis is not connected" : "Add a reference to explore this area"}</small></span><span>{analysisOpen ? "−" : "+"}</span>
          </button>
          {analysisOpen && <div className="analysis-placeholder"><span className="status-pip" />No AI analysis provider connected. Your reference stays in this browser.</div>}
        </section>

        <section className="workflow-card panel">
          <div className="section-title-row"><div><span className="step-index">03</span><h2>Build your prompt</h2></div><span className="optional-label">EDITABLE</span></div>
          <div className="prompt-editor-heading"><label className="form-label" htmlFor="generated-prompt">Generated AI prompt</label><span>Write or paste your own</span></div>
          <textarea id="generated-prompt" className="text-area prompt-area" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Your production-ready prompt will appear here when an AI prompt provider is connected. You can also write your own." rows={5} />
          <div className="prompt-actions"><button type="button" className="button-quiet" onClick={() => { if (prompt) void navigator.clipboard?.writeText(prompt); }}>Copy prompt</button><button type="button" className="button-quiet" disabled title="Connect an AI analysis provider to generate prompts">Regenerate</button><button type="button" className="button-secondary" onClick={() => void savePrompt()}>Save prompt</button></div>
          {savedMessage && <p className="inline-feedback" role="status">{savedMessage}</p>}
        </section>
      </section>

      <aside className="create-aside">
        <section className="panel settings-card">
          <div className="aside-heading"><div><p className="eyebrow">OUTPUT</p><h2>Configure creation</h2></div><span className="settings-spark">✳</span></div>
          <div className="field-label">OUTPUT TYPE</div>
          <div className="media-choice" role="group" aria-label="Output type">
            <button type="button" className={mediaType === "image" ? "chosen" : ""} onClick={() => setMediaType("image")}><span>▧</span>Image</button>
            <button type="button" className={mediaType === "video" ? "chosen" : ""} onClick={() => setMediaType("video")}><span>▷</span>Video</button>
          </div>
          <PresetSelector mediaType={mediaType} value={presetId} onChange={setPresetId} />
          {mode === "simple" ? (
            <div className="basic-setting">
              {mediaType === "image" ? (
                <>
                  <div className="field-label">SHAPE</div>
                  <div className="ratio-options" role="group" aria-label="Image shape">
                    {(["16:9", "1:1", "9:16"] as AspectRatio[]).map((ratio) => <button key={ratio} type="button" className={aspectRatio === ratio ? "chosen" : ""} onClick={() => setAspectRatio(ratio)}><span className={`ratio-shape ratio-${ratio.replace(":", "-")}`} />{ratio}</button>)}
                  </div>
                </>
              ) : (
                <>
                  <div className="field-label">DURATION <span>PROVIDER REQUIRED</span></div>
                  <input className="text-input disabled-input" disabled placeholder="Duration options unavailable" />
                </>
              )}
              <div className="provider-hint"><span className="status-pip" /><span>Connect a generation provider to unlock creation.</span></div>
            </div>
          ) : (
            <div className="pro-controls">
              <div className="field-label">PROVIDER</div><select className="text-input disabled-input" disabled><option>No providers connected</option></select>
              <div className="field-label">BASE MODEL</div><select className="text-input disabled-input" disabled><option>Provider capability required</option></select>
              <div className="field-label">PRESET STRENGTH</div><input className="text-input disabled-input" disabled placeholder="Strength metadata unavailable" />
              <div className="field-label">SEED / RESOLUTION / DURATION</div><input className="text-input disabled-input" disabled placeholder="Provider capability required" />
            </div>
          )}
          <button type="button" className="generate-button" onClick={() => void generate()} disabled={isSubmitting}>
            <span>{isSubmitting ? "Checking provider…" : "Generate"}</span><span>↗</span>
          </button>
          <p className="generate-note">No output is created until a real provider is connected.</p>
          {generationError && <div className="generation-error" role="status">{generationError}</div>}
        </section>
        <section className="panel readiness-card"><span className="readiness-icon">◌</span><div><strong>Ready when you are</strong><p>Connect a provider to generate images and video.</p><a href="/settings">View settings <span>→</span></a></div></section>
      </aside>
    </div>
  );
}
