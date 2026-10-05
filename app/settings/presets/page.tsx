"use client";

import { useState } from "react";
import { PresetBrowser } from "@/components/presets/preset-browser";
import { filterPresets, presetCatalog } from "@/lib/presets/registry";

export default function PresetManagerPage() {
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const imageCount = filterPresets(presetCatalog, "image").length;
  const videoCount = filterPresets(presetCatalog, "video").length;
  return (
    <div className="subpage preset-manager-page">
      <div className="page-heading"><div><p className="eyebrow">SETTINGS / REGISTRY</p><h1>Preset <em>manager.</em></h1><p className="page-subtitle">Browse the catalog. Availability requires a connected backend that can verify installed models.</p></div><span className="registry-version">REGISTRY V1</span></div>
      <div className="manager-tabs" role="tablist" aria-label="Preset media type">
        <button type="button" role="tab" aria-selected={mediaType === "image"} className={mediaType === "image" ? "active" : ""} onClick={() => setMediaType("image")}>Image <span>{imageCount}</span></button>
        <button type="button" role="tab" aria-selected={mediaType === "video"} className={mediaType === "video" ? "active" : ""} onClick={() => setMediaType("video")}>Video <span>{videoCount}</span></button>
      </div>
      <PresetBrowser mediaType={mediaType} />
      <p className="storage-footnote"><span className="status-pip" /> Catalog registration does not indicate installation. No backend discovery is connected.</p>
    </div>
  );
}
