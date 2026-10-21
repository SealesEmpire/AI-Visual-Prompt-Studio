import Link from "next/link";
import { SavedPrompts } from "@/components/library/saved-prompts";
import { PageHeading } from "@/components/ui/page-heading";

export default function LibraryPage() {
  return (
    <div className="subpage">
      <PageHeading eyebrow="COLLECTION" title="Your" emphasis="library." description="Saved prompts and generated assets, all in one place." actions={<Link href="/create" className="button-secondary">＋ New prompt</Link>} />
      <div className="library-tabs"><span className="library-tab active">Saved prompts</span><span className="library-tab disabled">Generated assets <small>Not connected</small></span></div>
      <SavedPrompts />
      <p className="storage-footnote"><span className="status-pip" /> Prompts are saved locally in this browser. Database and generated asset storage are not connected.</p>
    </div>
  );
}
