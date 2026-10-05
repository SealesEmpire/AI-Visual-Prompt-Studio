"use client";

import { useEffect, useRef, useState } from "react";
import { acceptedMediaTypes, isSupportedMediaType, isVideoMediaType } from "@/lib/media/file-types";
import type { MediaAsset } from "@/types/application";

const acceptedTypes = acceptedMediaTypes.join(",");

export function MediaInput({
  asset,
  onChange,
  onAnalyze,
  isAnalyzed = false,
}: {
  asset: MediaAsset | null;
  onChange: (asset: MediaAsset | null) => void;
  onAnalyze?: (file: File) => void;
  isAnalyzed?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const safePreview = getLocalPreviewUrl(preview);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function setPreviewUrl(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }

  function accept(file?: File) {
    if (!file) return;
    if (!isSupportedMediaType(file.type)) {
      window.alert("Choose a JPG, PNG, WEBP, MP4, MOV, or WEBM file.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    fileRef.current = file;
    if (inputRef.current) inputRef.current.value = "";
    onChange({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      url,
    });
  }

  function remove() {
    setPreviewUrl(null);
    fileRef.current = null;
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      className={`media-dropzone${dragging ? " is-dragging" : ""}${asset ? " has-asset" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files[0]); }}
    >
      <input ref={inputRef} type="file" accept={acceptedTypes} className="sr-only" aria-label="Choose image or video" onChange={(event) => accept(event.target.files?.[0])} />
      {asset && preview ? (
        <div className="media-preview">
          {safePreview && isVideoMediaType(asset.mimeType) ? <video src={safePreview} controls playsInline /> : safePreview ? <img src={safePreview} alt={`Preview of ${asset.name}`} /> : <span className="field-note">Preview unavailable.</span>}
          <div className="media-preview-meta"><strong>{asset.name}</strong><span>{formatBytes(asset.size)} · {asset.mimeType}</span></div>
          <div className="media-preview-actions"><button type="button" className="button-secondary" onClick={() => inputRef.current?.click()}>Replace</button><button type="button" className="button-quiet" onClick={remove}>Remove</button></div>
          {onAnalyze && <button type="button" className="button-quiet analyze-media-button" disabled={!fileRef.current || isVideoMediaType(asset.mimeType)} onClick={() => { if (fileRef.current) onAnalyze(fileRef.current); }}>Analyze image</button>}
          <p className="field-note">Preview runs in this browser. Media is {isAnalyzed ? "analyzed by the configured AI provider." : "not uploaded or analyzed."}</p>
        </div>
      ) : (
        <button type="button" className="media-empty" onClick={() => inputRef.current?.click()}>
          <span className="upload-glyph">↑</span>
          <strong>Drop an image or video here</strong>
          <span>or <span className="text-link">browse files</span></span>
          <small>JPG · PNG · WEBP · MP4 · MOV · WEBM</small>
        </button>
      )}
    </div>
  );
}

function getLocalPreviewUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "blob:" && url.origin === window.location.origin
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
