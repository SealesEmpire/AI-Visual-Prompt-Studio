"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterPresets,
  presetCatalog,
  resolveAvailability,
  searchPresets,
  updatePresetState,
  type GenerationPreset,
  type PresetAvailability,
  type PresetMediaType,
  type PresetState,
} from "@/lib/presets/registry";

type PresetFilter = "favorites" | "recent" | "compatible" | "all";

const stateStorageKey = "frame:preset-state:v1";

export function usePresetState() {
  const [state, setState] = useState<PresetState>({ favorites: [], recent: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(stateStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PresetState>;
        setState({
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          recent: Array.isArray(parsed.recent) ? parsed.recent : [],
        });
      }
    } catch {
      return;
    }
  }, []);

  function update(presetId: string, action: "favorite" | "unfavorite" | "use") {
    setState((current) => {
      const next = updatePresetState(current, presetId, action);
      try {
        localStorage.setItem(stateStorageKey, JSON.stringify(next));
      } catch {
        // Browser storage can be unavailable in private or restricted sessions.
      }
      return next;
    });
  }

  return { state, update };
}

export function PresetAvailabilityBadge({ availability }: { availability: PresetAvailability }) {
  const labels: Record<PresetAvailability, string> = {
    available: "Available",
    not_installed: "Not installed",
    not_configured: "Not configured",
    incompatible: "Incompatible",
    disabled: "Disabled",
    checking: "Checking",
  };
  return <span className={`availability-badge availability-${availability}`}>{labels[availability]}</span>;
}

export function PresetVariantBadge({ variant }: { variant?: GenerationPreset["variant"] }) {
  if (!variant) return null;
  return <span className={`variant-badge variant-${variant}`}>{variant.toUpperCase()}</span>;
}

export function PresetSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="preset-search">
      <span aria-hidden="true">⌕</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search presets…" aria-label="Search presets" />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Clear search">×</button>}
    </label>
  );
}

export function PresetFilters({
  active,
  onChange,
  favoritesCount,
  recentCount,
  compatibleCount,
}: {
  active: PresetFilter;
  onChange: (filter: PresetFilter) => void;
  favoritesCount: number;
  recentCount: number;
  compatibleCount: number;
}) {
  const filters: Array<{ id: PresetFilter; label: string; count?: number }> = [
    { id: "favorites", label: "Favorites", count: favoritesCount },
    { id: "recent", label: "Recent", count: recentCount },
    { id: "compatible", label: "Compatible", count: compatibleCount },
    { id: "all", label: "All" },
  ];
  return (
    <div className="preset-filters" role="tablist" aria-label="Preset filters">
      {filters.map((filter) => (
        <button key={filter.id} type="button" role="tab" aria-selected={active === filter.id} className={active === filter.id ? "selected" : ""} onClick={() => onChange(filter.id)}>
          {filter.label}{filter.count !== undefined && <span>{filter.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PresetCard({
  preset,
  availability,
  favorite,
  selected,
  onFavorite,
  onSelect,
}: {
  preset: GenerationPreset;
  availability: PresetAvailability;
  favorite: boolean;
  selected?: boolean;
  onFavorite: () => void;
  onSelect?: () => void;
}) {
  return (
    <article className={`preset-card${selected ? " preset-card-selected" : ""}`}>
      <button type="button" className="preset-card-main" onClick={onSelect} disabled={!onSelect} aria-pressed={selected}>
        <span className="preset-name">{preset.displayName}</span>
        <span className="preset-card-meta">
          <PresetVariantBadge variant={preset.variant} />
          <PresetAvailabilityBadge availability={availability} />
        </span>
      </button>
      <button type="button" className={`favorite-button${favorite ? " favorited" : ""}`} aria-label={favorite ? `Remove ${preset.displayName} from favorites` : `Add ${preset.displayName} to favorites`} aria-pressed={favorite} onClick={onFavorite}>
        {favorite ? "★" : "☆"}
      </button>
    </article>
  );
}

export function PresetSelector({
  mediaType,
  value,
  onChange,
  compatibleModelIds,
}: {
  mediaType: PresetMediaType;
  value: string | null;
  onChange: (presetId: string | null) => void;
  compatibleModelIds?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PresetFilter>("all");
  const { state, update } = usePresetState();
  const catalog = useMemo(
    () => filterPresets(presetCatalog, mediaType, compatibleModelIds),
    [mediaType, compatibleModelIds],
  );
  const compatibleCatalog = compatibleModelIds ? catalog : [];
  const favorites = catalog.filter((preset) => state.favorites.includes(preset.id));
  const recent = catalog.filter((preset) => state.recent.includes(preset.id));
  const filtered = searchPresets(
    filter === "favorites" ? favorites
      : filter === "recent" ? recent
        : filter === "compatible" ? compatibleCatalog
          : catalog,
    query,
  );
  const selectedPreset = presetCatalog.find((preset) => preset.id === value);

  function select(presetId: string | null) {
    onChange(presetId);
    if (presetId) update(presetId, "use");
    setOpen(false);
  }

  return (
    <>
      <div className="field-label">PRESET <span>OPTIONAL</span></div>
      <button type="button" className="preset-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <span><small>PRESET</small><strong>{selectedPreset?.displayName ?? "Automatic"}</strong></span>
        <span className="trigger-arrow">›</span>
      </button>
      {open && (
        <div className="preset-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="preset-dialog" role="dialog" aria-modal="true" aria-labelledby="preset-dialog-title">
            <header className="preset-dialog-header">
              <div><p className="eyebrow">PRESET / LORA</p><h2 id="preset-dialog-title">Choose a preset</h2></div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close preset browser">×</button>
            </header>
            <PresetSearch value={query} onChange={setQuery} />
            <PresetFilters
              active={filter}
              onChange={setFilter}
              favoritesCount={favorites.length}
              recentCount={recent.length}
              compatibleCount={compatibleCatalog.length}
            />
            <div className="preset-results">
              <button type="button" className={`automatic-option${value === null ? " selected" : ""}`} onClick={() => select(null)}>
                <span><strong>Automatic</strong><small>Let the provider choose</small></span>
                <span>{value === null ? "✓" : "›"}</span>
              </button>
              {filter === "compatible" && compatibleModelIds === undefined ? (
                <div className="empty-inline"><strong>Compatibility not verified</strong><span>Select a configured model to filter compatible presets.</span></div>
              ) : filtered.length === 0 ? (
                <div className="empty-inline"><strong>No presets found</strong><span>Try another filter or search term.</span></div>
              ) : filtered.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  availability={resolveAvailability(preset, { providerConfigured: false })}
                  favorite={state.favorites.includes(preset.id)}
                  selected={preset.id === value}
                  onFavorite={() => update(preset.id, state.favorites.includes(preset.id) ? "unfavorite" : "favorite")}
                  onSelect={() => select(preset.id)}
                />
              ))}
            </div>
            <footer className="preset-dialog-footer"><span>{filtered.length} presets · {mediaType.toUpperCase()}</span><button type="button" className="button-secondary" onClick={() => setOpen(false)}>Done</button></footer>
          </section>
        </div>
      )}
    </>
  );
}

export function PresetBrowser({ mediaType }: { mediaType: "image" | "video" }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PresetFilter>("all");
  const { state, update } = usePresetState();
  const catalog = useMemo(() => filterPresets(presetCatalog, mediaType), [mediaType]);
  const favorites = catalog.filter((preset) => state.favorites.includes(preset.id));
  const recent = catalog.filter((preset) => state.recent.includes(preset.id));
  const filtered = searchPresets(
    filter === "favorites" ? favorites : filter === "recent" ? recent : catalog,
    query,
  );
  return (
    <section className="panel preset-manager-panel">
      <div className="preset-manager-tools">
        <PresetSearch value={query} onChange={setQuery} />
        <PresetFilters active={filter} onChange={setFilter} favoritesCount={favorites.length} recentCount={recent.length} compatibleCount={0} />
      </div>
      {filter === "compatible" ? (
        <div className="empty-inline"><strong>Compatibility not verified</strong><span>No provider or base model is connected to report verified compatibility.</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-inline"><strong>{filter === "favorites" ? "No favorites yet" : "No presets found"}</strong><span>Use the star to save presets you use often.</span></div>
      ) : (
        <div className="preset-manager-list">
          {filtered.map((preset) => (
            <div className="manager-row" key={preset.id}>
              <div className="manager-name"><span className="media-type-dot" /> <strong>{preset.displayName}</strong><span className="manager-media">{mediaType.toUpperCase()}</span></div>
              <div className="manager-details"><PresetVariantBadge variant={preset.variant} /><span className="muted-small">Compatibility not verified</span></div>
              <PresetAvailabilityBadge availability={resolveAvailability(preset, { providerConfigured: false })} />
              <button type="button" className={`favorite-button${state.favorites.includes(preset.id) ? " favorited" : ""}`} aria-label={state.favorites.includes(preset.id) ? `Remove ${preset.displayName} from favorites` : `Add ${preset.displayName} to favorites`} onClick={() => update(preset.id, state.favorites.includes(preset.id) ? "unfavorite" : "favorite")}>{state.favorites.includes(preset.id) ? "★" : "☆"}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PresetCounts() {
  const images = filterPresets(presetCatalog, "image").length;
  const videos = filterPresets(presetCatalog, "video").length;
  return <span>{images} image · {videos} video presets</span>;
}
