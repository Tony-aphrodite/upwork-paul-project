import type { Metadata } from "next";
import { Logo } from "@/components/ui";
import { setupTokenValid } from "@/lib/navigators";
import { MIN_PASSWORD } from "@/lib/validate";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set your password", referrer: "no-referrer" };

/** A navigator's one-time setup link: choose a password, then straight into the case list. */
export default async function Setup({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const who = /^[A-Za-z0-9_-]{40,60}$/.test(token) ? await setupTokenValid(token) : null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="card w-full max-w-sm p-7">
        <Logo />
        {who ? (
          <>
            <h1 className="mt-6 text-[22px]">Welcome, {who.name}</h1>
            <p className="mt-1 text-[14px] text-muted">Choose a password for {who.email}. Use at least {MIN_PASSWORD} characters; a short sentence works well.</p>
            <SetupForm token={token} />
          </>
        ) : (
          <>
            <h1 className="mt-6 text-[22px]">This link has expired</h1>
            <p className="mt-1 text-[14px] text-muted">Setup links work once, for 48 hours. Ask for a new one.</p>
          </>
        )}
      </div>
    </div>
  );
}
