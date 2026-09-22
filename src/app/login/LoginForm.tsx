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
      const password = new FormData(e.currentTarget).get("password");
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (res.ok) router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/admin");
      else { setError((await res.json()).error ?? "Sign-in failed"); setBusy(false); }
    }}>
      <div><label htmlFor="password" className="label">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} /></div>
      {error && <p id="login-error" role="alert" className="text-[13.5px] font-semibold text-now">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Sign in</button>
    </form>
  );
}
