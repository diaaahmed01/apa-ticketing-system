"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type IssuedView, type Organization, type RoleRef, type UserView } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Avatar, Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { RowsSkeleton } from "@/components/Skeletons";
import { Spinner } from "@/components/Spinner";
import { toast } from "@/components/Toast";

type Draft = { id?: number; username: string; fullName: string; email: string; organization: Organization; preferredLang: "en" | "ar"; roles: string[] };
const EMPTY: Draft = { username: "", fullName: "", email: "", organization: "PORT", preferredLang: "en", roles: [] };
const ORG_LABEL: Record<Organization, string> = { PORT: "Port", VENDOR: "HQ" };

export default function UsersPage() {
  const { me, can } = useSession();
  const [users, setUsers] = useState<UserView[] | null>(null);
  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [org, setOrg] = useState<"ALL" | Organization>("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<{ title: string; data: IssuedView } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "reset" | "deactivate"; user: UserView } | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.get<UserView[]>("/api/users"), api.get<RoleRef[]>("/api/roles")]);
      setUsers(u);
      setRoles(r);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load users.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (users ?? []).filter((u) =>
      (org === "ALL" || u.organization === org) &&
      (status === "ALL" || (status === "ACTIVE") === u.active) &&
      (!needle || [u.fullName, u.username, u.email ?? ""].some((v) => v.toLowerCase().includes(needle))));
  }, [users, q, org, status]);

  const replace = (u: UserView) => setUsers((list) => (list ?? []).map((x) => (x.id === u.id ? u : x)));

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const body = { username: draft.username, fullName: draft.fullName, email: draft.email, organization: draft.organization, preferredLang: draft.preferredLang, roles: draft.roles };
    try {
      if (draft.id == null) {
        const res = await api.post<IssuedView>("/api/users", body);
        setUsers((list) => [...(list ?? []), res.user].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setDraft(null);
        setIssued({ title: `${res.user.fullName} can now sign in`, data: res });
      } else {
        let u = await api.put<UserView>(`/api/users/${draft.id}`, body);
        const before = users?.find((x) => x.id === draft.id);
        const rolesChanged = before && before.roles.map((r) => r.code).sort().join() !== [...draft.roles].sort().join();
        if (rolesChanged) u = await api.put<UserView>(`/api/users/${draft.id}/roles`, { roles: draft.roles });
        replace(u);
        setDraft(null);
        toast(`Saved ${u.fullName}`);
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't save the user.");
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    const { kind, user } = confirm;
    setConfirming(true);
    try {
      if (kind === "reset") {
        const res = await api.post<IssuedView>(`/api/users/${user.id}/reset-password`);
        replace(res.user);
        setIssued({ title: `New temporary password for ${user.fullName}`, data: res });
      } else {
        replace(await api.post<UserView>(`/api/users/${user.id}/deactivate`));
        toast(`${user.fullName} is deactivated and signed out`);
      }
      setConfirm(null);
    } catch (e) {
      setConfirm(null);
      toast(e instanceof ApiError ? e.message : "That didn't work.", "error");
    } finally {
      setConfirming(false);
    }
  }

  async function activate(u: UserView) {
    try {
      replace(await api.post<UserView>(`/api/users/${u.id}/activate`));
      toast(`${u.fullName} is active again`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't activate the user.", "error");
    }
  }

  const canManage = can("USER_MANAGE");
  const canRoles = can("USER_ASSIGN_ROLES");
  const canReset = can("USER_RESET_PASSWORD");
  const activeCount = users?.filter((u) => u.active).length ?? 0;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p className="sub">
            {users ? <><b className="num">{activeCount}</b> active of <b className="num">{users.length}</b> accounts.</> : "Loading accounts…"}{" "}
            ATS accounts are separate from Orbit and any other system.
          </p>
        </div>
        {canManage && (
          <div className="head-actions">
            <button className="btn primary" type="button" onClick={() => { setFormError(null); setDraft({ ...EMPTY }); }}>
              <Icon name="userPlus" size="sm" />Create user
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-row" style={{ marginBottom: 16 }}>
        <label className="local-search">
          <Icon name="search" size="sm" />
          <input type="search" placeholder="Search name, username or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        </label>
        <div className="seg" role="group" aria-label="Organization">
          {(["ALL", "PORT", "VENDOR"] as const).map((o) => (
            <button key={o} type="button" aria-pressed={org === o} onClick={() => setOrg(o)}>{o === "ALL" ? "Everyone" : ORG_LABEL[o]}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Status">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{s === "ALL" ? "Any status" : s === "ACTIVE" ? "Active" : "Deactivated"}</button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="empty panel">
          <h3>Users didn&apos;t load</h3>
          <p>{loadError}</p>
          <button className="btn" type="button" onClick={load}>Try again</button>
        </div>
      ) : !users ? (
        <RowsSkeleton rows={6} />
      ) : shown.length === 0 ? (
        <div className="empty panel">
          <h3>No users match</h3>
          <p>Clear the search or switch the filters back to everyone.</p>
          <button className="btn" type="button" onClick={() => { setQ(""); setOrg("ALL"); setStatus("ALL"); }}>Clear filters</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>User</th><th>Email</th><th>Organization</th><th>Roles</th><th>Status</th><th>Last sign-in</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className={u.active ? undefined : "row-muted"}>
                  <td>
                    <div className="person">
                      <Avatar name={u.fullName} color={u.avatarColor} />
                      <div style={{ minWidth: 0 }}>
                        <div className="name" dir="auto">{u.fullName}{u.id === me?.id && <span className="you">You</span>}</div>
                        <div className="org">{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-2)" }}>{u.email ?? <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td><span className={"tag " + (u.organization === "PORT" ? "" : "env-test")}>{ORG_LABEL[u.organization]}</span></td>
                  <td><div className="role-chips">{u.roles.map((r) => <span key={r.code} className="role-chip">{r.name}</span>)}</div></td>
                  <td><UserStatus u={u} /></td>
                  <td className="num" style={{ color: "var(--text-2)" }}>{u.lastLoginAt ? fmt(u.lastLoginAt) : <span style={{ color: "var(--muted)" }}>Never</span>}</td>
                  <td>
                    <RowActions
                      u={u}
                      isSelf={u.id === me?.id}
                      canManage={canManage}
                      canReset={canReset}
                      onEdit={() => {
                        setFormError(null);
                        setDraft({ id: u.id, username: u.username, fullName: u.fullName, email: u.email ?? "", organization: u.organization, preferredLang: u.preferredLang, roles: u.roles.map((r) => r.code) });
                      }}
                      onReset={() => setConfirm({ kind: "reset", user: u })}
                      onDeactivate={() => setConfirm({ kind: "deactivate", user: u })}
                      onActivate={() => activate(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        wide
        title={draft?.id == null ? "Create user" : "Edit user"}
        description={draft?.id == null ? "They'll get a temporary password and choose their own at first sign-in." : undefined}
        footer={<>
          <button className="btn ghost" type="button" onClick={() => setDraft(null)}>Cancel</button>
          <button className={"btn primary" + (saving ? " is-busy" : "")} type="button" onClick={save} disabled={saving || !draft?.fullName.trim() || !draft?.username.trim() || !draft?.roles.length}>
            {saving && <Spinner />}{saving ? "Saving…" : draft?.id == null ? "Create user" : "Save changes"}
          </button>
        </>}
      >
        {draft && (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="u-name">Full name</label>
              <input id="u-name" className="input" dir="auto" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="u-username">Username</label>
              <input id="u-username" className="input" value={draft.username} disabled={draft.id != null} onChange={(e) => setDraft({ ...draft, username: e.target.value })} autoCapitalize="none" spellCheck={false} />
              {draft.id != null && <span className="hint">Usernames can&apos;t be changed.</span>}
            </div>
            <div className="field">
              <label htmlFor="u-email">Email <span className="opt">optional</span></label>
              <input id="u-email" className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="field">
              <span className="field-label">Organization</span>
              <div className="seg" role="group" aria-label="Organization">
                {(["PORT", "VENDOR"] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={draft.organization === o} onClick={() => setDraft({ ...draft, organization: o })}>{ORG_LABEL[o]}</button>
                ))}
              </div>
            </div>
            <div className="field span-2">
              <span className="field-label">Roles {!canRoles && draft.id != null && <span className="opt">— you can&apos;t change roles</span>}</span>
              <div className="role-picker">
                {roles.map((r) => {
                  const on = draft.roles.includes(r.code);
                  return (
                    <label key={r.code} className={"role-opt" + (on ? " on" : "")}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={on}
                        disabled={!canRoles}
                        onChange={() => setDraft({ ...draft, roles: on ? draft.roles.filter((c) => c !== r.code) : [...draft.roles, r.code] })}
                      />
                      <span>{r.name}{r.nameAr && <small className="ar" lang="ar">{r.nameAr}</small>}</span>
                    </label>
                  );
                })}
              </div>
              <span className="hint">A user can hold several roles; their permissions add up.</span>
            </div>
            <div className="field">
              <span className="field-label">Interface language</span>
              <div className="seg" role="group" aria-label="Language">
                <button type="button" aria-pressed={draft.preferredLang === "en"} onClick={() => setDraft({ ...draft, preferredLang: "en" })}>English</button>
                <button type="button" aria-pressed={draft.preferredLang === "ar"} onClick={() => setDraft({ ...draft, preferredLang: "ar" })}>العربية</button>
              </div>
            </div>
            {formError && <p className="err span-2" role="alert">{formError}</p>}
          </div>
        )}
      </Modal>

      {/* Temporary password — shown once */}
      <Modal
        open={!!issued}
        onClose={() => setIssued(null)}
        title={issued?.title ?? ""}
        description="Give them this temporary password through a private channel. It won't be shown again; they'll replace it at first sign-in."
        footer={<button className="btn primary" type="button" onClick={() => setIssued(null)}>Done</button>}
      >
        {issued && (
          <div className="issued">
            <div><span className="tk-k">Username</span><code>{issued.data.user.username}</code></div>
            <div>
              <span className="tk-k">Temporary password</span>
              <div className="secret-row">
                <code className="secret">{issued.data.temporaryPassword}</code>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(issued.data.temporaryPassword).then(() => toast("Password copied"), () => toast("Copy failed — select it manually", "error"))}
                >
                  <Icon name="copy" size="sm" />Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmations */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "reset" ? `Reset ${confirm.user.fullName}'s password?` : `Deactivate ${confirm?.user.fullName}?`}
        description={confirm?.kind === "reset"
          ? "Their current password stops working and they're signed out everywhere. You'll get a temporary password to pass on."
          : "They're signed out immediately and can't sign in. Their tickets, comments and history stay. You can reactivate them later."}
        footer={<>
          <button className="btn ghost" type="button" disabled={confirming} onClick={() => setConfirm(null)}>Cancel</button>
          <button className={"btn " + (confirm?.kind === "deactivate" ? "danger" : "navy") + (confirming ? " is-busy" : "")} type="button" disabled={confirming} onClick={runConfirm}>
            {confirming && <Spinner />}{confirm?.kind === "reset" ? "Reset password" : "Deactivate user"}
          </button>
        </>}
      />
    </main>
  );
}

function UserStatus({ u }: { u: UserView }) {
  if (!u.active) return <span className="status s-cancelled">Deactivated</span>;
  if (u.locked) return <span className="status s-blocked">Locked</span>;
  if (u.mustChangePassword) return <span className="status s-testing">Awaiting first sign-in</span>;
  return <span className="status s-closed">Active</span>;
}

function RowActions({ u, isSelf, canManage, canReset, onEdit, onReset, onDeactivate, onActivate }: {
  u: UserView; isSelf: boolean; canManage: boolean; canReset: boolean;
  onEdit: () => void; onReset: () => void; onDeactivate: () => void; onActivate: () => void;
}) {
  if (!canManage && !canReset) return null;
  return (
    <div className="row-actions">
      {canManage && <button className="btn ghost sm" type="button" onClick={onEdit}><Icon name="edit" size="sm" />Edit</button>}
      {canReset && <button className="btn ghost sm" type="button" onClick={onReset}><Icon name="key" size="sm" />Reset</button>}
      {canManage && !isSelf && (u.active
        ? <button className="btn ghost sm danger" type="button" onClick={onDeactivate}>Deactivate</button>
        : <button className="btn ghost sm" type="button" onClick={onActivate}>Activate</button>)}
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
