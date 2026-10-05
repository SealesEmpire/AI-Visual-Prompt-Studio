import Link from "next/link";

export function ProjectEmptyState() {
  return (
    <div className="empty-state panel">
      <span className="empty-state-icon">▣</span>
      <p className="eyebrow">PROJECTS</p>
      <h2>No projects yet.</h2>
      <p>Project persistence is not connected. Your workspace is ready for a project store.</p>
      <Link href="/create" className="button-primary">Open Create <span>↗</span></Link>
    </div>
  );
}
