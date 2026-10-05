import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="subpage">
      <div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Your <em>projects.</em></h1><p className="page-subtitle">Keep ideas, prompts, and generated work together.</p></div><button type="button" className="button-secondary" disabled title="Project storage is not connected">＋ New project</button></div>
      <div className="empty-state panel"><span className="empty-state-icon">▣</span><p className="eyebrow">PROJECTS</p><h2>No projects yet.</h2><p>Project persistence is not connected. Your workspace is ready for a project store.</p><Link href="/create" className="button-primary">Open Create <span>↗</span></Link></div>
    </div>
  );
}
