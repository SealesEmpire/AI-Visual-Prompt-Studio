import { PageHeading } from "@/components/ui/page-heading";
import { ProjectsList } from "@/components/projects/projects-list";

export default function ProjectsPage() {
  return (
    <div className="subpage">
      <PageHeading eyebrow="WORKSPACE" title="Your" emphasis="projects." description="Keep ideas, prompts, and generated work together." />
      <ProjectsList />
    </div>
  );
}
