import Link from "next/link";
import { SavedPrompts } from "@/components/library/saved-prompts";

export default function LibraryPage() {
  return (
    <div className="subpage">
      <div className="page-heading"><div><p className="eyebrow">COLLECTION</p><h1>Your <em>library.</em></h1><p className="page-subtitle">Saved prompts and generated assets, all in one place.</p></div><Link href="/create" className="button-secondary">＋ New prompt</Link></div>
      <div className="library-tabs"><span className="library-tab active">Saved prompts</span><span className="library-tab disabled">Generated assets <small>Not connected</small></span></div>
      <SavedPrompts />
      <p className="storage-footnote"><span className="status-pip" /> Prompts are saved locally in this browser. Database and generated asset storage are not connected.</p>
    </div>
  );
}
