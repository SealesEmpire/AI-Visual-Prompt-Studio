import Link from "next/link";
import { PresetCounts } from "@/components/presets/preset-browser";

export default function SettingsPage() {
  return (
    <div className="subpage">
      <div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>Studio <em>settings.</em></h1><p className="page-subtitle">Connections and tools for your workspace.</p></div></div>
      <section className="settings-list">
        <article className="panel settings-row"><span className="settings-row-icon">✳</span><div><strong>Generation providers</strong><p>No image or video generation provider connected.</p></div><span className="connection-state">NOT CONNECTED</span></article>
        <Link href="/settings/presets" className="panel settings-row"><span className="settings-row-icon">▦</span><div><strong>Preset manager</strong><p>Browse, search, and favorite registered presets.</p><small><PresetCounts /></small></div><span className="settings-row-arrow">→</span></Link>
        <article className="panel settings-row"><span className="settings-row-icon">▤</span><div><strong>Project database</strong><p>Projects and generation history have no connected database.</p></div><span className="connection-state">NOT CONNECTED</span></article>
        <article className="panel settings-row"><span className="settings-row-icon">⌁</span><div><strong>My Basket</strong><p>External storage delivery is not configured.</p></div><span className="connection-state">NOT CONNECTED</span></article>
      </section>
    </div>
  );
}
