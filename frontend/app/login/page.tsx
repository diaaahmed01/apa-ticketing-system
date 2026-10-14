"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type Me } from "@/lib/api";
import { AuthTicket, PasswordField } from "@/components/AuthTicket";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>("/api/auth/login", { username: username.trim(), password });
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(me.mustChangePassword ? "/change-password?next=" + encodeURIComponent(safeNext) : safeNext);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Try again.");
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <AuthTicket footer={<>Forgot your password? Ask your system administrator to reset it.</>}>
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-sub">Use the account issued to you by the ATS administrator.</p>
      <form onSubmit={submit} className="auth-form" noValidate>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className={"input" + (error ? " invalid" : "")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
          />
        </div>
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
        {error && (
          <p className="err" role="alert">
            <svg className="icon xs" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            {error}
          </p>
        )}
        <button className="btn primary lg auth-submit" type="submit" disabled={busy || !username.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthTicket>
  );
}
