import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="card w-full max-w-sm p-7">
        <Logo />
        <h1 className="mt-6 text-[22px]">Navigator sign-in</h1>
        <p className="mt-1 text-[14px] text-muted">For the Ageing Navigator team only.</p>
        <Suspense><LoginForm /></Suspense>
      </div>
    </div>
  );
}
