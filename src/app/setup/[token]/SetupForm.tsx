"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SetupForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-5 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setError("");
      const f = new FormData(e.currentTarget);
      const password = String(f.get("password") ?? "");
      if (password.length < 12) { setError("Use at least 12 characters."); return; }
      if (password !== f.get("again")) { setError("The two passwords are different."); return; }
      setBusy(true);
      const res = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }).catch(() => null);
      if (res?.ok) { router.push("/admin"); router.refresh(); return; }
      setError((await res?.json().catch(() => null))?.error ?? "That did not work."); setBusy(false);
    }}>
      <div><label htmlFor="password" className="label">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="field" /></div>
      <div><label htmlFor="again" className="label">Type it again</label><input id="again" name="again" type="password" autoComplete="new-password" required className="field" aria-invalid={!!error} aria-describedby={error ? "setup-error" : undefined} /></div>
      {error && <p id="setup-error" role="alert" className="text-[13.5px] font-semibold text-now">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Set password and sign in</button>
    </form>
  );
}
