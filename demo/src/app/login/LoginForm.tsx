"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-5 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError("");
      const f = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) }).catch(() => null);
      if (res?.ok) { router.push(next?.startsWith("/admin") ? next : "/admin"); router.refresh(); return; }
      setError((await res?.json().catch(() => null))?.error ?? "Sign-in failed"); setBusy(false);
    }}>
      <div><label htmlFor="email" className="label">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="field" /></div>
      <div><label htmlFor="password" className="label">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} /></div>
      {error && <p id="login-error" role="alert" className="text-[13.5px] font-semibold text-now">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Sign in</button>
    </form>
  );
}
