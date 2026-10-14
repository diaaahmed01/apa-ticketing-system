"use client";

import { Perf, TicketPaper, VPerf } from "./TicketPaper";

/**
 * The sign-in surfaces: a landscape ticket. The ATS logo is the stub, the perforation
 * separates it from the form. On narrow screens it stacks, and the tear runs across.
 */
export function AuthTicket({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="auth-page">
      <TicketPaper className="auth-ticket" paperClassName="auth-paper">
        <div className="auth-logo">
          {/* The supplied lockup misspells "Ticketing" in its raster text, so only the mark is
              used and the name is set as live text. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="" width={448} height={220} />
          <div className="auth-wordmark">
            <strong>APA Ticketing System</strong>
            <span>Port of Alexandria</span>
          </div>
        </div>
        <VPerf />
        <div className="auth-perf-h"><Perf /></div>
        <div className="auth-main">
          <div className="auth-body">{children}</div>
          {footer && <div className="auth-foot">{footer}</div>}
        </div>
      </TicketPaper>
    </main>
  );
}

export function PasswordField({
  id, label, value, onChange, autoComplete, invalid, autoFocus,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  autoComplete: string; invalid?: boolean; autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          className={"input" + (invalid ? " invalid" : "")}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
        />
        <button
          type="button"
          className="pw-toggle"
          aria-label="Show password"
          onClick={(e) => {
            const input = document.getElementById(id) as HTMLInputElement;
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
            e.currentTarget.dataset.shown = String(show);
          }}
        >
          <svg className="icon sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </div>
    </div>
  );
}
