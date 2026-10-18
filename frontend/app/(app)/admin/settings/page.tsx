"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Icon } from "@/components/Icon";
import { RowsSkeleton } from "@/components/Skeletons";
import { Spinner } from "@/components/Spinner";
import { fmtDate, fmtSize } from "@/lib/tickets";

interface SettingsView {
  email: { enabled: boolean; host: string; port: number; from: string; starttls: boolean; authConfigured: boolean };
  outbox: { pending: number; sent: number; failed: number; skipped: number; lastError: string | null; lastErrorAt: string | null; lastSentAt: string | null };
  attachments: { dir: string; maxMb: number; usedBytes: number };
  publicUrl: string;
  version: string;
  database: { schemaVersion: number | null };
}

interface TestResult { status: "SENT" | "FAILED" | "QUEUED"; error: string | null }

const MAIL_VARS = ["ATS_MAIL_ENABLED", "ATS_MAIL_HOST", "ATS_MAIL_PORT", "ATS_MAIL_FROM", "ATS_MAIL_USERNAME", "ATS_MAIL_PASSWORD", "ATS_MAIL_STARTTLS"];

export default function SettingsPage() {
  const { can, loading } = useSession();
  const allowed = can("SETTINGS_MANAGE");
  const [data, setData] = useState<SettingsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<SettingsView>("/api/admin/settings"));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load settings.");
    }
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (!loading && !allowed) {
    return (
      <main className="page page-narrow">
        <div className="empty panel">
          <Icon name="lock" />
          <h3>You don&apos;t have access to this page</h3>
          <p>Viewing settings needs the &ldquo;Manage system settings&rdquo; permission. Ask a system administrator if you need it.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Read-only: these values come from the server&apos;s environment variables.</p>
        </div>
        <div className="head-actions">
          <button className="btn" type="button" onClick={load}>Refresh</button>
        </div>
      </div>

      {loadError ? (
        <div className="empty panel"><h3>Settings didn&apos;t load</h3><p>{loadError}</p><button className="btn" type="button" onClick={load}>Try again</button></div>
      ) : !data ? (
        <RowsSkeleton rows={6} />
      ) : (
        <div className="settings-grid">
          <section className="panel" aria-labelledby="set-email">
            <div className="panel-head">
              <h3 id="set-email">Email</h3>
              <span className={"status " + (data.email.enabled ? "s-closed" : "s-cancelled")}>{data.email.enabled ? "On" : "Off"}</span>
            </div>
            <div className="panel-body">
              <dl className="kv">
                <dt>Server</dt><dd className="mono">{data.email.host ? `${data.email.host}:${data.email.port}` : "Not set"}</dd>
                <dt>From address</dt><dd>{data.email.from || "Not set"}</dd>
                <dt>STARTTLS</dt><dd>{data.email.starttls ? "Yes" : "No"}</dd>
                <dt>Sign-in configured</dt><dd>{data.email.authConfigured ? "Yes" : "No"}</dd>
              </dl>
              <p className="env-help">
                {MAIL_VARS.map((v) => <code key={v}>{v}</code>)}
                <br />Set these on the server and restart the backend to change email settings.
              </p>
            </div>
          </section>

          <section className="panel" aria-labelledby="set-outbox">
            <div className="panel-head"><h3 id="set-outbox">Email outbox</h3></div>
            <div className="panel-body">
              <div className="count-row">
                <div className={"count-cell" + (data.outbox.pending > 0 ? " warn" : "")}><b>{data.outbox.pending}</b><span>Pending</span></div>
                <div className={"count-cell" + (data.outbox.sent > 0 ? " good" : "")}><b>{data.outbox.sent}</b><span>Sent</span></div>
                <div className={"count-cell" + (data.outbox.failed > 0 ? " bad" : "")}><b>{data.outbox.failed}</b><span>Failed</span></div>
                <div className="count-cell"><b>{data.outbox.skipped}</b><span>Skipped</span></div>
              </div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                Last sent: {data.outbox.lastSentAt ? fmtDate(data.outbox.lastSentAt, true) : "never"}
              </p>
              {data.outbox.lastError ? (
                <>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Last error{data.outbox.lastErrorAt ? ` (${fmtDate(data.outbox.lastErrorAt, true)})` : ""}</p>
                  <pre className="err-block">{data.outbox.lastError}</pre>
                </>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>No delivery errors recorded.</p>
              )}
            </div>
          </section>

          <TestEmail enabled={data.email.enabled} onDone={load} />

          <section className="panel" aria-labelledby="set-att">
            <div className="panel-head"><h3 id="set-att">Attachments</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>Folder</dt><dd className="mono">{data.attachments.dir}</dd>
                <dt>File size limit</dt><dd>{data.attachments.maxMb} MB per file</dd>
                <dt>Space used</dt><dd>{fmtSize(data.attachments.usedBytes)}</dd>
              </dl>
              <p className="env-help"><code>ATS_ATTACHMENTS_DIR</code><code>ATS_ATTACHMENTS_MAX_MB</code></p>
            </div>
          </section>

          <section className="panel span-2" aria-labelledby="set-sys">
            <div className="panel-head"><h3 id="set-sys">System</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>Public URL</dt><dd className="mono">{data.publicUrl}</dd>
                <dt>Version</dt><dd>{data.version}</dd>
                <dt>Database schema</dt><dd>{data.database.schemaVersion == null ? "Unknown" : "V" + String(data.database.schemaVersion).padStart(3, "0")}</dd>
              </dl>
              <p className="env-help"><code>ATS_PUBLIC_URL</code> is used for the ticket links inside emails.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function TestEmail({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad" | "info"; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await api.post<TestResult>("/api/admin/settings/test-email", { to: to.trim() });
      if (r.status === "SENT") setResult({ tone: "ok", text: `Test email sent to ${to.trim()}.` });
      else if (r.status === "FAILED") setResult({ tone: "bad", text: `Sending failed: ${r.error ?? "unknown error"}` });
      else setResult({ tone: "info", text: r.error ?? "Queued. It will be sent once email is turned on." });
      onDone();
    } catch (err) {
      setResult({ tone: "bad", text: err instanceof ApiError ? err.message : "Couldn't send the test email." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="set-test">
      <div className="panel-head"><h3 id="set-test">Send a test email</h3></div>
      <div className="panel-body">
        <form onSubmit={send}>
          <div className="field">
            <label htmlFor="test-to">Send to</label>
            <div className="test-mail">
              <input id="test-to" className="input" type="email" required autoComplete="email" placeholder="name@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
              <button className={"btn primary" + (busy ? " is-busy" : "")} type="submit" disabled={busy || !to.trim()}>{busy && <Spinner />}{busy ? "Sending…" : "Send test"}</button>
            </div>
            <span className="hint">{enabled ? "Sent right away through the configured mail server." : "Email is off, so the message will only be queued."}</span>
          </div>
        </form>
        {result && <p className={"test-result " + result.tone} role="status">{result.text}</p>}
      </div>
    </section>
  );
}
