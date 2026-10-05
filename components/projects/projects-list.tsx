"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/types/application";

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { projects?: Project[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "PROJECT_STORAGE_UNAVAILABLE");
        setProjects(result.projects ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "PROJECT_STORAGE_UNAVAILABLE"))
      .finally(() => setLoading(false));
  }, []);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !result.project) throw new Error(result.error ?? "PROJECT_CREATION_FAILED");
      setProjects((current) => [result.project!, ...current]);
      setName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PROJECT_CREATION_FAILED");
    }
  }

  if (loading) return <div className="empty-state panel"><p className="eyebrow">PROJECTS</p><h2>Loading projects…</h2></div>;
  return (
    <>
      <form className="project-create-form" onSubmit={createProject}>
        <label className="sr-only" htmlFor="project-name">New project name</label>
        <input id="project-name" className="text-input" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} placeholder="Name a new project" />
        <button type="submit" className="button-secondary">＋ New project</button>
      </form>
      {error && <p className="generation-error" role="status">{error}</p>}
      {projects.length === 0 ? (
        <div className="empty-state panel"><span className="empty-state-icon">▣</span><p className="eyebrow">PROJECTS</p><h2>No projects yet.</h2><p>Create a project to keep prompts and generation settings together.</p><Link href="/create" className="button-primary">Open Create <span>↗</span></Link></div>
      ) : (
        <div className="project-grid">{projects.map((project) => <article className="panel project-card" key={project.id}>
          <span className="feature-number">PROJECT</span><h2>{project.name}</h2><p>Created {new Date(project.createdAt).toLocaleDateString()}</p>
          <span>{project.prompts.length} prompts · {project.assets.length} assets</span>
          {project.assets.map((asset) => <a className="project-asset-link" href={`/api/assets/${asset.id}`} key={asset.id}>
            {asset.mimeType.startsWith("video/")
              ? <video src={`/api/assets/${asset.id}`} controls playsInline />
              : <img src={`/api/assets/${asset.id}`} alt={asset.name} />}
            <span>{asset.name}</span>
          </a>)}
          {project.prompts.map((artifact) => <details key={artifact.id}><summary>{artifact.prompt.slice(0, 72)}</summary><p>{artifact.prompt}</p></details>)}
        </article>)}</div>
      )}
    </>
  );
}
