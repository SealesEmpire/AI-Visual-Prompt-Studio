import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow"><span className="gold-line" />YOUR IDEAS, IN FOCUS</p>
          <h1>Make room<br />for <em>imagination.</em></h1>
          <p className="hero-subtitle">One thoughtful workspace for turning visual ideas into prompts ready for your creative tools.</p>
          <Link href="/create" className="button-primary">Start creating <span>↗</span></Link>
          <div className="hero-footnote"><span className="status-pip" /> Workspace preview · generation provider not connected</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-core"><span>AV</span></div>
          <div className="art-tag tag-prompt"><span className="tag-dot blue-dot" /> PROMPT ARCHITECT</div>
          <div className="art-tag tag-presets"><span className="tag-dot gold-dot" /> PRESET LIBRARY</div>
          <div className="art-caption">01 — CREATIVE SYSTEMS</div>
        </div>
      </section>
      <section className="home-section">
        <div className="section-intro"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Start with a direction.</h2></div><span>Everything begins with an idea worth exploring.</span></div>
        <div className="feature-grid">
          <Link href="/create" className="feature-card"><span className="feature-number">01 / CREATE</span><span className="feature-icon">✳</span><h3>Shape the idea</h3><p>Draft a visual brief, add a reference, and build a prompt at your pace.</p><span className="feature-link">Open workspace <span>→</span></span></Link>
          <Link href="/settings/presets" className="feature-card"><span className="feature-number">02 / EXPLORE</span><span className="feature-icon">▦</span><h3>Find your preset</h3><p>Browse the registered image and video catalog. Installation is verified by a connected backend.</p><span className="feature-link">Browse presets <span>→</span></span></Link>
          <Link href="/library" className="feature-card"><span className="feature-number">03 / COLLECT</span><span className="feature-icon">▤</span><h3>Keep your work</h3><p>Saved prompts stay in this browser until app storage is connected.</p><span className="feature-link">Open library <span>→</span></span></Link>
        </div>
      </section>
      <section className="home-bottom-note"><span className="status-pip" /><p><strong>A clear starting point.</strong> Provider, project database, and external storage connections are not configured yet.</p><Link href="/settings">Workspace settings <span>→</span></Link></section>
    </div>
  );
}
