"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { LogOut } from "lucide-react";
import { Logo } from "./ui";

const NAV: [string, string][] = [["Workspace", "/admin"], ["Pilot", "/admin/pilot"], ["Modules", "/admin/modules"], ["Repository", "/admin/repository"], ["Docs", "/docs"]];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); };
  return (
    <div className="min-h-screen">
      <div className="bg-gold/25 text-[13px] text-ink"><div className="wrap py-1.5">Proof of concept with fictional families only. Kinfield Navigator is a fictional name used for this demo.</div></div>
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Link href="/admin" aria-label="Kinfield Action Plans, workspace"><Logo /></Link>
          <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
            {NAV.map(([l, h]) => {
              const on = h === "/admin" ? path === "/admin" || path.startsWith("/admin/plans") : path.startsWith(h);
              return <Link key={h} href={h} aria-current={on ? "page" : undefined} className={clsx("rounded-lg px-2 py-2 text-[13.5px] font-semibold sm:px-3 sm:text-[14px]", on ? "bg-brand-soft text-brand" : "text-muted hover:text-brand")}>{l}</Link>;
            })}
            <button onClick={signOut} className="btn-ghost !px-2 sm:ml-1" aria-label="Sign out"><LogOut size={16} aria-hidden="true" /><span className="hidden md:inline">Sign out</span></button>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap py-8">{children}</main>
    </div>
  );
}
