"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, LogOut } from "lucide-react";
import { Logo } from "./ui";

export function AdminShell({ name, draft, children }: { name: string; draft: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); };
  return (
    <div className="min-h-screen">
      {draft && <div className="bg-soon-soft text-[13px] text-soon"><div className="wrap py-1.5"><strong>Draft content.</strong> The questions and wording have not all been approved yet; released plans are marked as a test version.</div></div>}
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center justify-between gap-3">
          <Link href="/admin" aria-label="Cases"><Logo /></Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <Link href="/admin" className="rounded-lg px-2.5 py-2 text-[14px] font-semibold text-brand hover:bg-brand-soft">Cases</Link>
            <a href="/api/admin/export" className="btn-ghost !px-2.5"><Download size={15} aria-hidden="true" /><span className="hidden sm:inline">Export CSV</span><span className="sr-only sm:hidden">Export CSV</span></a>
            <span className="hidden px-2 text-[13.5px] text-muted md:inline">{name}</span>
            <button onClick={signOut} className="btn-ghost !px-2.5" aria-label="Sign out"><LogOut size={16} aria-hidden="true" /><span className="hidden md:inline">Sign out</span></button>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap py-7">{children}</main>
    </div>
  );
}
