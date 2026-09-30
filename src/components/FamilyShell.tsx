import Link from "next/link";
import { Logo } from "./ui";

/** Header and footer for the family's pages. The footer states what the service is not, on every page. */
export function FamilyShell({ children, notice }: { children: React.ReactNode; notice?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center"><Link href="/" aria-label="Ageing Navigator, home"><Logo /></Link></div>
      </header>
      <main id="main" className="wrap flex-1 py-8 sm:py-10">{children}</main>
      <footer className="border-t border-line bg-white">
        <p className="wrap py-6 text-[13px] text-muted">
          {notice ?? "Ageing Navigator provides independent information and navigation. It does not provide medical, legal or financial advice, and does not carry out formal needs assessments."}
        </p>
      </footer>
    </div>
  );
}
