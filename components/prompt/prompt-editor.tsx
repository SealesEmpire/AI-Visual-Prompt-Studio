"use client";

export function PromptEditor({
  prompt,
  onChange,
  onSave,
  savedMessage,
}: {
  prompt: string;
  onChange: (value: string) => void;
  onSave: () => void;
  savedMessage: string;
}) {
  return (
    <>
      <div className="prompt-editor-heading"><label className="form-label" htmlFor="generated-prompt">Generated AI prompt</label><span>Write or paste your own</span></div>
      <textarea id="generated-prompt" className="text-area prompt-area" value={prompt} onChange={(event) => onChange(event.target.value)} placeholder="Your production-ready prompt will appear here when an AI prompt provider is connected. You can also write your own." rows={5} />
      <div className="prompt-actions">
        <button type="button" className="button-quiet" onClick={() => { if (prompt) void navigator.clipboard?.writeText(prompt); }}>Copy prompt</button>
        <button type="button" className="button-quiet" disabled title="Connect an AI analysis provider to generate prompts">Regenerate</button>
        <button type="button" className="button-secondary" onClick={onSave}>Save prompt</button>
      </div>
      {savedMessage && <p className="inline-feedback" role="status">{savedMessage}</p>}
    </>
  );
}
