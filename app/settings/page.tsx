import Link from "next/link";
import { PresetCounts } from "@/components/presets/preset-browser";
import { PageHeading } from "@/components/ui/page-heading";
import { ProviderStatuses } from "@/components/settings/provider-statuses";

export default function SettingsPage() {
  return (
    <div className="subpage">
      <PageHeading eyebrow="PREFERENCES" title="Studio" emphasis="settings." description="Connections and tools for your workspace." />
      <section className="settings-list">
        <ProviderStatuses />
        <Link href="/settings/presets" className="panel settings-row"><span className="settings-row-icon">▦</span><div><strong>Preset manager</strong><p>Browse, search, and favorite registered presets.</p><small><PresetCounts /></small></div><span className="settings-row-arrow">→</span></Link>
        <article className="panel settings-row"><span className="settings-row-icon">▤</span><div><strong>Project database</strong><p>Projects and generation history have no connected database.</p></div><span className="connection-state">NOT CONNECTED</span></article>
        <article className="panel settings-row"><span className="settings-row-icon">⌁</span><div><strong>My Basket</strong><p>External storage delivery is not configured.</p></div><span className="connection-state">NOT CONNECTED</span></article>
      </section>
    </div>
  );
}
