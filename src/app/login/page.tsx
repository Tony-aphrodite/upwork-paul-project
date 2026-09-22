import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { isDemoPassword } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="card w-full max-w-sm p-7">
        <Logo />
        <h1 className="mt-6 text-[22px]">Sign in to the test console</h1>
        <p className="mt-1 text-[14px] text-muted">Internal access only. Family information is never shown without signing in.</p>
        <Suspense><LoginForm /></Suspense>
        {isDemoPassword() && <p className="mt-5 rounded-lg bg-brand-soft p-3 text-[13px]">Demo password: <code className="font-mono font-bold">navigator-demo</code></p>}
      </div>
    </div>
  );
}
