"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type PermRole, type UserView } from "@/lib/api";
import { Avatar, Icon } from "./Icon";
import { Modal } from "./Modal";
import { RowsSkeleton } from "./Skeletons";
import { Spinner } from "./Spinner";
import { toast } from "./Toast";

/* Role editor and user-role assignment: the second and third tabs of the Permissions Center. */

const ORG_LABEL = { PORT: "Port", VENDOR: "HQ" } as const;
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((c) => b.includes(c));

/* ------------------------------------------------------------------ roles */

interface RoleDraft { id?: number; name: string; nameAr: string; description: string; system: boolean }

export function RolesTab({ roles, onChanged }: { roles: PermRole[]; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PermRole | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const body = { name: draft.name.trim(), nameAr: draft.nameAr.trim() || null, description: draft.description.trim() || null };
    try {
      if (draft.id == null) await api.post("/api/roles", body);
      else await api.put(`/api/roles/${draft.id}`, body);
      await onChanged();
      toast(draft.id == null ? `Role “${body.name}” created` : "Role updated");
      setDraft(null);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't save the role.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setDelBusy(true);
    setDelError(null);
    try {
      await api.del(`/api/roles/${deleting.id}`);
      await onChanged();
      toast(`Role “${deleting.name}” deleted`);
      setDeleting(null);
    } catch (e) {
      setDelError(e instanceof ApiError ? e.message : "Couldn't delete the role.");
    } finally {
      setDelBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar-row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <p className="hint" style={{ margin: 0 }}>
          <Icon name="info" size="xs" /> New roles start with no permissions and appear as a column in the permission matrix.
        </p>
        <button className="btn primary" type="button" onClick={() => { setFormError(null); setDraft({ name: "", nameAr: "", description: "", system: false }); }}>
          <Icon name="plus" size="sm" />New role
        </button>
      </div>

      <div className="role-grid">
        {roles.map((r) => (
          <article key={r.id} className="panel role-card">
            <div className="role-card-head">
              <div>
                <h3 dir="auto">{r.name}</h3>
                {r.nameAr && <div className="role-ar" dir="rtl" lang="ar">{r.nameAr}</div>}
              </div>
              {r.system && <span className="role-badge" title="Built-in role: it can be renamed but not deleted">System</span>}
            </div>
            <p className={"role-desc" + (r.description ? "" : " none")} dir="auto">{r.description || "No description"}</p>
            <div className="role-card-foot">
              <span className="role-users"><Icon name="users" size="sm" />{r.activeUsers} active {r.activeUsers === 1 ? "user" : "users"}</span>
              <div className="role-actions">
                <button className="btn ghost sm" type="button" aria-label={`Edit ${r.name}`}
                  onClick={() => { setFormError(null); setDraft({ id: r.id, name: r.name, nameAr: r.nameAr ?? "", description: r.description ?? "", system: r.system }); }}>
                  <Icon name="edit" size="sm" />Edit
                </button>
                {!r.system && (
                  <button className="btn ghost sm danger" type="button" aria-label={`Delete ${r.name}`}
                    disabled={r.activeUsers > 0} title={r.activeUsers > 0 ? "Move its users to another role first" : undefined}
                    onClick={() => { setDelError(null); setDeleting(r); }}>
                    <Icon name="trash" size="sm" />Delete
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={!!draft}
        onClose={() => { if (!saving) setDraft(null); }}
        title={draft?.id == null ? "New role" : "Edit role"}
        description={draft?.system ? "Built-in roles keep their permissions and identity; only the wording can change." : undefined}
        footer={<>
          <button className="btn ghost" type="button" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
          <button className={"btn primary" + (saving ? " is-busy" : "")} type="button" onClick={save} disabled={saving || !draft?.name.trim()}>
            {saving && <Spinner />}{saving ? "Saving…" : draft?.id == null ? "Create role" : "Save changes"}
          </button>
        </>}
      >
        {draft && (
          <form className="role-form" onSubmit={(e) => { e.preventDefault(); if (draft.name.trim() && !saving) save(); }}>
            <div className="field">
              <label htmlFor="role-name">Name</label>
              <input id="role-name" className="input" value={draft.name} maxLength={80} autoFocus dir="auto"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Release Manager" />
            </div>
            <div className="field">
              <label htmlFor="role-ar">Arabic name <span className="opt">optional</span></label>
              <input id="role-ar" className="input ar" dir="rtl" lang="ar" value={draft.nameAr} maxLength={80}
                onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="role-desc">Description <span className="opt">optional</span></label>
              <textarea id="role-desc" className="textarea" rows={3} dir="auto" value={draft.description} maxLength={400}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this role is for" />
            </div>
            {formError && <p className="err" role="alert"><Icon name="alert" size="sm" />{formError}</p>}
          </form>
        )}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => { if (!delBusy) setDeleting(null); }}
        title={`Delete “${deleting?.name}”?`}
        description="The role and all of its permissions are removed. This is recorded in the permission history."
        footer={<>
          <button className="btn ghost" type="button" onClick={() => setDeleting(null)} disabled={delBusy}>Cancel</button>
          <button className={"btn danger" + (delBusy ? " is-busy" : "")} type="button" onClick={remove} disabled={delBusy}>
            {delBusy && <Spinner />}{delBusy ? "Deleting…" : "Delete role"}
          </button>
        </>}
      >
        {delError && <p className="err" role="alert"><Icon name="alert" size="sm" />{delError}</p>}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ user roles */

export function UserRolesTab({ roles, canAssign, meId, onChanged }: {
  roles: PermRole[]; canAssign: boolean; meId: number | undefined; onChanged: () => Promise<void>;
}) {
  const [users, setUsers] = useState<UserView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<number, string[]>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  async function load() {
    try {
      setUsers(await api.get<UserView[]>("/api/users"));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load users.");
    }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (Object.keys(edits).length === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [edits]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => !needle || [u.fullName, u.username, u.email ?? ""].some((v) => v.toLowerCase().includes(needle)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users, q]);

  const current = (u: UserView) => edits[u.id] ?? u.roles.map((r) => r.code);

  function toggle(u: UserView, code: string) {
    const cur = current(u);
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    setRowError(({ [u.id]: _drop, ...rest }) => rest);
    setEdits((e) => {
      const copy = { ...e };
      if (sameSet(next, u.roles.map((r) => r.code))) delete copy[u.id]; else copy[u.id] = next;
      return copy;
    });
  }

  function reset(u: UserView) {
    setEdits(({ [u.id]: _drop, ...rest }) => rest);
    setRowError(({ [u.id]: _drop, ...rest }) => rest);
  }

  async function save(u: UserView) {
    setSaving(u.id);
    setRowError(({ [u.id]: _drop, ...rest }) => rest);
    try {
      const saved = await api.put<UserView>(`/api/users/${u.id}/roles`, { roles: current(u) });
      setUsers((list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
      reset(u);
      toast(`Roles updated for ${u.fullName}`);
      onChanged().catch(() => {});
    } catch (e) {
      setRowError((m) => ({ ...m, [u.id]: e instanceof ApiError ? e.message : "Couldn't save the roles." }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="toolbar-row" style={{ marginBottom: 16 }}>
        <label className="local-search">
          <Icon name="search" size="sm" />
          <input type="search" placeholder="Search name, username or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        </label>
        {!canAssign && <span className="hint"><Icon name="lock" size="xs" /> You can see who holds each role, but changing it needs the “Assign roles to users” permission.</span>}
      </div>

      {loadError ? (
        <div className="empty panel"><h3>Users didn&apos;t load</h3><p>{loadError}</p><button className="btn" type="button" onClick={load}>Try again</button></div>
      ) : !users ? (
        <RowsSkeleton rows={6} />
      ) : shown.length === 0 ? (
        <div className="empty panel"><h3>No users match</h3><p>Clear the search to see everyone.</p><button className="btn" type="button" onClick={() => setQ("")}>Clear search</button></div>
      ) : (
        <div className="panel">
          <ul className="ur-list">
            {shown.map((u) => {
              const cur = current(u);
              const dirty = u.id in edits;
              const busy = saving === u.id;
              return (
                <li key={u.id} className={"ur-row" + (dirty ? " is-dirty" : "") + (u.active ? "" : " is-off")}>
                  <div className="ur-who">
                    <Avatar name={u.fullName} color={u.avatarColor} />
                    <div>
                      <strong dir="auto">{u.fullName}{u.id === meId && <span className="muted"> (you)</span>}</strong>
                      <small>{ORG_LABEL[u.organization]} · {u.active ? "Active" : "Deactivated"}</small>
                    </div>
                  </div>
                  <div className="ur-chips" role="group" aria-label={`Roles for ${u.fullName}`}>
                    {roles.map((r) => (
                      <button key={r.code} type="button" className="role-chip" aria-pressed={cur.includes(r.code)}
                        disabled={!canAssign || busy} onClick={() => toggle(u, r.code)}>
                        {cur.includes(r.code) && <Icon name="check" size="xs" />}{r.name}
                      </button>
                    ))}
                  </div>
                  <div className="ur-actions">
                    {dirty && (
                      <>
                        <button className="btn ghost sm" type="button" onClick={() => reset(u)} disabled={busy}>Reset</button>
                        <button className={"btn primary sm" + (busy ? " is-busy" : "")} type="button" onClick={() => save(u)}
                          disabled={busy || cur.length === 0} title={cur.length === 0 ? "A user needs at least one role" : undefined}>
                          {busy && <Spinner />}{busy ? "Saving…" : "Save"}
                        </button>
                      </>
                    )}
                  </div>
                  {rowError[u.id] && <p className="err ur-err" role="alert"><Icon name="alert" size="sm" />{rowError[u.id]}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
