import { PageHeading } from "@/components/ui/page-heading";
import { ProjectEmptyState } from "@/components/projects/project-empty-state";

export default function ProjectsPage() {
  return (
    <div className="subpage">
      <PageHeading eyebrow="WORKSPACE" title="Your" emphasis="projects." description="Keep ideas, prompts, and generated work together." actions={<button type="button" className="button-secondary" disabled title="Project storage is not connected">＋ New project</button>} />
      <ProjectEmptyState />
    </div>
  );
}
