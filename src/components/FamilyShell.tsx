import Link from "next/link";
import { Logo } from "./ui";
import { content } from "@/lib/pilot/library";

/** Header and footer for the family's pages. The footer states what the service is not (the client's notice), on every page. */
export function FamilyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-card">Skip to content</a>
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center"><Link href="/" aria-label="Ageing Navigator, home"><Logo /></Link></div>
      </header>
      <main id="main" className="wrap flex-1 py-8 sm:py-10">{children}</main>
      <footer className="border-t border-line bg-white">
        <p className="wrap py-6 text-[13px] text-muted">{content.texts.notice}</p>
      </footer>
    </div>
  );
}
