"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/create", label: "Create", icon: "✳" },
  { href: "/projects", label: "Projects", icon: "▣" },
  { href: "/library", label: "Library", icon: "▤" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="studio-frame">
      <aside className="desktop-sidebar">
        <Link href="/" className="brand-lockup" aria-label="AI Visual Prompt Studio home">
          <span className="brand-mark">AV</span>
          <span><strong>AI VISUAL</strong><small>PROMPT STUDIO</small></span>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="connection-dot" />
          <div><strong>Workspace ready</strong><small>Provider not connected</small></div>
        </div>
      </aside>
      <div className="main-column">
        <header className="top-bar">
          <div className="mobile-brand">
            <span className="brand-mark">AV</span>
            <strong>AI VISUAL</strong>
          </div>
          <div className="top-bar-note"><span className="connection-dot" /> AI studio <span className="top-bar-divider">/</span> Workspace</div>
          <Link href="/settings" className="avatar" aria-label="Open settings">⚙</Link>
        </header>
        <main className="page-content">{children}</main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: string;
  pathname: string;
}) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
