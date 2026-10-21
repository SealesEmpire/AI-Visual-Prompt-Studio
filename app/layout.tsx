import type { Metadata } from "next";
import { StudioShell } from "@/components/layout/studio-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Visual Prompt Studio",
  description: "A workspace for shaping visual ideas and production-ready prompts.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><StudioShell>{children}</StudioShell></body>
    </html>
  );
}
