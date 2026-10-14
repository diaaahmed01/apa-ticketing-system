"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type Me } from "@/lib/api";
import { AuthTicket, PasswordField } from "@/components/AuthTicket";
import { Avatar } from "@/components/Icon";

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Me>("/api/auth/me").then(setMe).catch(() => {}); }, []);

  const rules = [
    { ok: next.length >= 10, text: "At least 10 characters" },
    { ok: /\p{L}/u.test(next) && /\d/.test(next), text: "Letters and numbers" },
    { ok: !!next && (!me || !next.toLowerCase().includes(me.username.toLowerCase())), text: "Doesn't contain your username" },
    { ok: !!next && next === confirm, text: "Both new passwords match" },
  ];
  const valid = rules.every((r) => r.ok) && !!current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.post<Me>("/api/auth/change-password", { currentPassword: current, newPassword: next });
      const target = params.get("next");
      router.replace(target && target.startsWith("/") && !target.startsWith("//") ? target : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change the password. Try again.");
      setBusy(false);
    }
  }

  async function signOut() {
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/login");
  }

  return (
    <AuthTicket footer={<button type="button" className="clear-link" onClick={signOut}>Sign in as someone else</button>}>
      {me && (
        <div className="auth-who">
          <Avatar name={me.fullName} color={me.avatarColor} />
          <div><strong>{me.fullName}</strong><span>{me.username}</span></div>
        </div>
      )}
      <h1 className="auth-title">{me?.mustChangePassword === false ? "Change your password" : "Choose your own password"}</h1>
      <p className="auth-sub">
        {me?.mustChangePassword === false
          ? "Changing it signs you out on every other device."
          : "You signed in with a temporary password. Pick a new one to continue."}
      </p>
      <form onSubmit={submit} className="auth-form" noValidate>
        <PasswordField id="current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        <PasswordField id="new" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordField id="confirm" label="Repeat new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <ul className="pw-rules" aria-label="Password requirements">
          {rules.map((r) => (
            <li key={r.text} className={r.ok ? "ok" : ""}>
              <svg className="icon xs" viewBox="0 0 24 24" aria-hidden="true">{r.ok ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="3" />}</svg>
              {r.text}
            </li>
          ))}
        </ul>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn primary lg auth-submit" type="submit" disabled={busy || !valid}>
          {busy ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </AuthTicket>
  );
}
