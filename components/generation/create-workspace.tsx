"use client";

import { useEffect, useState } from "react";
import { MediaInput } from "@/components/media/media-input";
import { PresetSelector } from "@/components/presets/preset-browser";
import { PromptEditor } from "@/components/prompt/prompt-editor";
import { browserPromptRepository } from "@/lib/storage/browser-prompts";
import type { GenerationConfiguration, GenerationJob, MediaAsset, MediaKind, PromptArtifact, VisualAnalysis } from "@/types/application";

type WorkspaceMode = "simple" | "pro";
type AspectRatio = "16:9" | "1:1" | "9:16";

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [analysis, setAnalysis] = useState<VisualAnalysis | undefined>();
  const [editingIntent, setEditingIntent] = useState<PromptArtifact["editingIntent"]>();
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [backgroundJob, setBackgroundJob] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<GenerationJob[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [reusedConfiguration, setReusedConfiguration] = useState<GenerationConfiguration | null>(null);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    let active = true;
    void fetch("/api/generation-jobs", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { jobs?: GenerationJob[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "GENERATION_HISTORY_UNAVAILABLE");
        if (active) setGenerationHistory(result.jobs ?? []);
      })
      .catch((error: unknown) => {
        if (active) setHistoryError(error instanceof Error ? error.message : "GENERATION_HISTORY_UNAVAILABLE");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!job || ["COMPLETE", "FAILED", "CANCELLED"].includes(job.status)) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!job || ["COMPLETE", "FAILED", "CANCELLED"].includes(job.status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/generation-jobs/${job.id}`, { cache: "no-store" });
        const result = await response.json() as { job?: GenerationJob; error?: string };
        if (!response.ok) {
          if (active) setJobError(result.error ?? "Unable to check generation status.");
          return;
        }
        if (active && result.job) {
          setJob(result.job);
          setGenerationHistory((items) => [result.job!, ...items.filter((item) => item.id !== result.job!.id)]);
        }
      } catch {
        if (active) setJobError("Generation status is temporarily unavailable.");
      }
      if (active) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 2500);
    return () => { active = false; clearTimeout(timer); };
  }, [job?.id, job?.status]);

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
      ...(analysis ? { analysis } : {}),
      ...(editingIntent ? { editingIntent } : {}),
    };
    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(artifact),
      });
      if (response.ok) {
        setSavedMessage("Saved to your account Library.");
      } else {
        await browserPromptRepository.save(artifact);
        setSavedMessage("Saved in this browser only. Account persistence is not configured.");
      }
    } catch {
      try {
        await browserPromptRepository.save(artifact);
        setSavedMessage("Saved in this browser only. Account persistence is unavailable.");
      } catch {
        setSavedMessage("Prompt storage is unavailable.");
      }
    }
  }

  async function analyzeImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    setGenerationError("");
    setIsAnalyzing(true);
    try {
      const dataUrl = await readDataUrl(file);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, dataUrl }),
      });
      const result = await response.json() as { analysis?: VisualAnalysis; error?: string };
      if (!response.ok) throw new Error(result.error ?? "VISUAL_ANALYSIS_FAILED");
      setAnalysis(result.analysis);
      setAnalysisOpen(true);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "VISUAL_ANALYSIS_FAILED");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function buildPrompt() {
    setGenerationError("");
    setIsBuildingPrompt(true);
    try {
      const response = await fetch("/api/prompts/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shortRequest: idea,
          goal,
          outputType: mediaType,
          ...(analysis ? { analysis } : {}),
          ...(presetId ? { presetId } : {}),
          ...(mediaType === "image" ? { aspectRatio } : {}),
          hasSourceMedia: Boolean(asset),
        }),
      });
      const result = await response.json() as { prompt?: { prompt: string; editingIntent?: PromptArtifact["editingIntent"] }; error?: string };
      if (!response.ok || !result.prompt) throw new Error(result.error ?? "PROMPT_ARCHITECT_FAILED");
      setPrompt(result.prompt.prompt);
      setEditingIntent(result.prompt.editingIntent);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "PROMPT_ARCHITECT_FAILED");
    } finally {
      setIsBuildingPrompt(false);
    }
  }

  async function generate() {
    setGenerationError("");
    setJobError("");
    setJob(null);
    setBackgroundJob(false);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaType,
          prompt: prompt || idea,
          presetIds: reusedConfiguration?.presetIds ?? (presetId ? [presetId] : []),
          ...(reusedConfiguration?.providerId ? { providerId: reusedConfiguration.providerId } : {}),
          ...(reusedConfiguration?.modelId ? { modelId: reusedConfiguration.modelId } : {}),
          ...(reusedConfiguration?.negativePrompt ? { negativePrompt: reusedConfiguration.negativePrompt } : {}),
          ...(reusedConfiguration?.presetVariants ? { presetVariants: reusedConfiguration.presetVariants } : {}),
          ...(reusedConfiguration?.presetStrengths ? { presetStrengths: reusedConfiguration.presetStrengths } : {}),
          ...(reusedConfiguration?.seed !== undefined ? { seed: reusedConfiguration.seed } : {}),
          ...(mediaType === "image" ? { aspectRatio: reusedConfiguration?.aspectRatio ?? aspectRatio } : {}),
          ...(reusedConfiguration?.width !== undefined ? { width: reusedConfiguration.width } : {}),
          ...(reusedConfiguration?.height !== undefined ? { height: reusedConfiguration.height } : {}),
          ...(reusedConfiguration?.duration !== undefined ? { duration: reusedConfiguration.duration } : {}),
          ...(asset ? { referenceAsset: { id: asset.id, name: asset.name, mimeType: asset.mimeType, size: asset.size } } : {}),
        }),
      });
      const result = await response.json() as { job?: GenerationJob; error?: string };
      if (!response.ok) setGenerationError(result.error ?? "Generation request failed.");
      else if (result.job) {
        setJob(result.job);
        setGenerationHistory((items) => [result.job!, ...items.filter((item) => item.id !== result.job!.id)]);
      }
    } catch {
      setGenerationError("Generation service is unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelJob() {
    if (!job) return;
    try {
      const response = await fetch(`/api/generation-jobs/${job.id}/cancel`, { method: "POST" });
      const result = await response.json() as { job?: GenerationJob; error?: string };
      if (!response.ok) throw new Error(result.error ?? "GENERATION_CANCELLATION_FAILED");
      if (result.job) {
        setJob(result.job);
        setGenerationHistory((items) => [result.job!, ...items.filter((item) => item.id !== result.job!.id)]);
      }
    } catch (error) {
      setJobError(error instanceof Error ? error.message : "GENERATION_CANCELLATION_FAILED");
    }
  }

  async function retryJob() {
    if (!job) return;
    setJobError("");
    try {
      const response = await fetch(`/api/generation-jobs/${job.id}/retry`, { method: "POST" });
      const result = await response.json() as { job?: GenerationJob; error?: string };
      if (!response.ok) throw new Error(result.error ?? "GENERATION_RETRY_FAILED");
      if (result.job) {
        setJob(result.job);
        setGenerationHistory((items) => [result.job!, ...items.filter((item) => item.id !== result.job!.id)]);
      }
    } catch (error) {
      setJobError(error instanceof Error ? error.message : "GENERATION_RETRY_FAILED");
    }
  }

  function reuseSettings(configuration: GenerationConfiguration) {
    setReusedConfiguration(configuration);
    setMediaType(configuration.mediaType);
    setPrompt(configuration.prompt);
    setPresetId(configuration.presetIds[0] ?? null);
    if (configuration.aspectRatio) setAspectRatio(configuration.aspectRatio);
    setGenerationError("");
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
          <MediaInput asset={asset} onChange={(nextAsset) => { setAsset(nextAsset); setAnalysis(undefined); setEditingIntent(undefined); }} onAnalyze={(file) => void analyzeImage(file)} isAnalyzed={Boolean(analysis)} />
        </section>

        <section className="workflow-card panel">
          <div className="section-title-row"><div><span className="step-index">02</span><h2>Describe your vision</h2></div><span className="optional-label">YOUR IDEA</span></div>
          <label className="form-label" htmlFor="visual-idea">What would you like it to look like?</label>
          <textarea id="visual-idea" className="text-area idea-area" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="A cinematic still of a quiet cabin in the mountains at blue hour…" rows={3} />
          <label className="form-label goal-label" htmlFor="visual-goal">What are you trying to accomplish?</label>
          <input id="visual-goal" className="text-input" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. Create a cover image for my travel journal" />
          <button type="button" className={`analysis-toggle${analysisOpen ? " open" : ""}`} onClick={() => setAnalysisOpen(!analysisOpen)} aria-expanded={analysisOpen}>
            <span><span className="analysis-icon">◉</span><strong>Visual analysis</strong><small>{asset?.mimeType.startsWith("video/") ? "Video analysis unavailable" : asset ? "Analyze this image with the configured service" : "Add an image reference to analyze"}</small></span><span>{analysisOpen ? "−" : "+"}</span>
          </button>
          {analysisOpen && <div className={`analysis-placeholder${analysis ? " analysis-result" : ""}`} aria-live="polite">{isAnalyzing ? <><span className="status-pip" />Analyzing image with the configured AI service…</> : analysis ? <><strong>{analysis.summary}</strong><span>{analysis.subjects.join(" · ")}</span><small>{analysis.observations.join(" · ")}</small></> : <><span className="status-pip" />{asset?.mimeType.startsWith("video/") ? "Video analysis is not configured; upload processing is not available." : "Analysis requires an authenticated account and configured AI model."}</>}</div>}
        </section>

        <section className="workflow-card panel">
          <div className="section-title-row"><div><span className="step-index">03</span><h2>Build your prompt</h2></div><span className="optional-label">EDITABLE</span></div>
          <PromptEditor prompt={prompt} onChange={setPrompt} onSave={() => void savePrompt()} onBuild={() => void buildPrompt()} isBuilding={isBuildingPrompt} savedMessage={savedMessage} />
        </section>
      </section>

      <aside className="create-aside">
        <section className="panel settings-card">
          <div className="aside-heading"><div><p className="eyebrow">OUTPUT</p><h2>Configure creation</h2></div><span className="settings-spark">✳</span></div>
          <div className="field-label">OUTPUT TYPE</div>
          <div className="media-choice" role="group" aria-label="Output type">
            <button type="button" className={mediaType === "image" ? "chosen" : ""} onClick={() => { setMediaType("image"); setReusedConfiguration(null); }}><span>▧</span>Image</button>
            <button type="button" className={mediaType === "video" ? "chosen" : ""} onClick={() => { setMediaType("video"); setReusedConfiguration(null); }}><span>▷</span>Video</button>
          </div>
          <PresetSelector mediaType={mediaType} value={presetId} onChange={(value) => { setPresetId(value); setReusedConfiguration(null); }} />
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
          <p className="generate-note">Only configured providers can return real generated assets; unavailable integrations fail explicitly.</p>
          {reusedConfiguration && <p className="provider-hint">Reusing {reusedConfiguration.providerId ?? "provider"} / {reusedConfiguration.modelId ?? "default model"}; availability will be checked before submission.</p>}
          {generationError && <div className="generation-error" role="status">{generationError}</div>}
          {job && backgroundJob && !["COMPLETE", "FAILED", "CANCELLED"].includes(job.status) && <button type="button" className="button-quiet" onClick={() => setBackgroundJob(false)}>Show background generation</button>}
          {job && !backgroundJob && <div className="job-card" aria-live="polite">
            <div className="job-heading"><span className="status-pip" /><strong>{job.status === "GENERATING" ? "Generating…" : job.status}</strong>{!["COMPLETE", "FAILED", "CANCELLED"].includes(job.status) && <button type="button" className="button-quiet" onClick={() => setBackgroundJob(true)}>Background</button>}</div>
            <p>Provider: {job.providerId ?? "—"} · Model: {job.configuration.modelId ?? "—"}</p>
            <p>Preset: {job.configuration.presetIds.join(", ") || "Automatic"} · Elapsed {formatElapsed(clock - new Date(job.createdAt).getTime())}</p>
            {typeof job.progress === "number" ? <progress max="100" value={job.progress} aria-label="Provider-reported generation progress" /> : !["COMPLETE", "FAILED", "CANCELLED"].includes(job.status) ? <div className="indeterminate-progress" aria-label="Generation in progress" /> : null}
            {job.status === "COMPLETE" && job.resultAsset && <a className="button-secondary" href={`/api/assets/${job.resultAsset.id}`}>View generated asset</a>}
            {job.status === "COMPLETE" && <button type="button" className="button-quiet" onClick={() => reuseSettings(job.configuration)}>Reuse settings</button>}
            {job.status === "FAILED" && <button type="button" className="button-secondary" onClick={() => void retryJob()}>Retry</button>}
            {!["COMPLETE", "FAILED", "CANCELLED"].includes(job.status) && <button type="button" className="button-quiet" onClick={() => void cancelJob()}>Cancel</button>}
            {job.error && <p className="job-error">{job.error}</p>}
            {jobError && <p className="job-error">{jobError}</p>}
          </div>}
          <div className="job-card" aria-live="polite">
            <div className="job-heading"><strong>Generation history</strong></div>
            {historyError && <p className="job-error">{historyError}</p>}
            {!historyError && generationHistory.length === 0 && <p>No persisted generations found.</p>}
            {generationHistory.slice(0, 5).map((item) => <div className="history-item" key={item.id}>
              <span>{item.configuration.mediaType} · {item.status} · {item.configuration.prompt.slice(0, 80)}</span>
              <button type="button" className="button-quiet" onClick={() => { setJob(item); setBackgroundJob(false); }}>Open</button>
              <button type="button" className="button-quiet" onClick={() => reuseSettings(item.configuration)}>Reuse settings</button>
              {item.resultAsset && <a className="button-quiet" href={`/api/assets/${item.resultAsset.id}`}>View asset</a>}
            </div>)}
          </div>
        </section>
        <section className="panel readiness-card"><span className="readiness-icon">◌</span><div><strong>Ready when you are</strong><p>Connect a provider to generate images and video.</p><a href="/settings">View settings <span>→</span></a></div></section>
      </aside>
    </div>
  );
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("IMAGE_READ_FAILED"));
    reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
