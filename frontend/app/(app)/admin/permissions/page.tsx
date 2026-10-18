"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api, ApiError, type PermChange, type PermChangeResult, type PermMatrix } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { RolesTab, UserRolesTab } from "@/components/RoleAdmin";
import { AdminPageSkeleton, RowsSkeleton } from "@/components/Skeletons";
import { Spinner } from "@/components/Spinner";
import { toast } from "@/components/Toast";

const ALWAYS = "ALWAYS";
const SHORT: Record<string, string> = {
  TICKET_CREATOR: "Creator", CURRENT_ASSIGNEE: "Assignee", COLLABORATOR: "Collaborator",
  ASSIGNED_REVIEWER: "Reviewer", ASSIGNED_TESTER: "Tester", COMMENT_AUTHOR: "Author", ATTACHMENT_OWNER: "Owner",
};

const key = (role: string, perm: string) => role + "|" + perm;
const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
/** A cell holds a set of condition codes: empty = no access, ["ALWAYS"] = unconditional, otherwise conditional. */
const norm = (s: string[]) => (s.includes(ALWAYS) ? [ALWAYS] : Array.from(new Set(s)).sort());
const modeOf = (s: string[]) => (s.length === 0 ? "none" : s[0] === ALWAYS ? "always" : "cond");

/** Groups follow the ticket's life, then administration (the API returns them alphabetically). */
const CATEGORY_ORDER = [
  "TICKETS", "ASSIGNMENTS", "COLLABORATORS", "CODE_REVIEW", "TESTING", "DEPLOYMENT", "PRODUCTION_VERIFICATION",
  "COMMENTS", "ATTACHMENTS", "DASHBOARD", "USER_MANAGEMENT", "MODULE_MANAGEMENT", "ADMINISTRATION",
];

function categoryName(c: string) {
  const t = c.replace(/_/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Pop = { role: string; perm: string; rect: DOMRect };

type PermTab = "matrix" | "roles" | "users";

export default function PermissionsPage() {
  return <Suspense fallback={<AdminPageSkeleton rows={8} action={false} />}><Permissions /></Suspense>;
}

function Permissions() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, can, loading } = useSession();
  const canUsers = can("USER_VIEW");
  const tabParam = params.get("tab");
  const tab: PermTab = tabParam === "roles" ? "roles" : tabParam === "users" && canUsers ? "users" : "matrix";
  const setTab = (t: PermTab) => {
    const sp = new URLSearchParams(params.toString());
    if (t === "matrix") sp.delete("tab"); else sp.set("tab", t);
    const qs = sp.toString();
    router.replace(qs ? "?" + qs : "/admin/permissions", { scroll: false });
  };
  const [matrix, setMatrix] = useState<PermMatrix | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [pop, setPop] = useState<Pop | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const allowed = can("ROLE_PERMISSION_MANAGE");

  const load = useCallback(async () => {
    try {
      setMatrix(await api.get<PermMatrix>("/api/admin/permissions"));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load permissions.");
    }
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const original = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const g of matrix?.grants ?? []) {
      const k = key(g.role, g.permission);
      m.set(k, [...(m.get(k) ?? []), g.condition]);
    }
    for (const [k, v] of m) m.set(k, norm(v));
    return m;
  }, [matrix]);

  useEffect(() => {
    if (!matrix) return;
    const codes = new Set(matrix.roles.map((r) => r.code));
    setStaged((s) => {
      const gone = Object.keys(s).filter((k) => !codes.has(k.split("|")[0]));
      if (gone.length === 0) return s;
      const copy = { ...s };
      gone.forEach((k) => delete copy[k]);
      return copy;
    });
  }, [matrix]);

  const orig = useCallback((role: string, perm: string) => original.get(key(role, perm)) ?? [], [original]);
  const current = (role: string, perm: string) => staged[key(role, perm)] ?? orig(role, perm);
  const dirtyCount = Object.keys(staged).length;

  function setCell(role: string, perm: string, next: string[]) {
    const n = norm(next);
    const k = key(role, perm);
    setStaged((s) => {
      const copy = { ...s };
      if (same(n, orig(role, perm))) delete copy[k]; else copy[k] = n;
      return copy;
    });
  }

  useEffect(() => {
    if (dirtyCount === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyCount]);

  const condLabel = useCallback((code: string) => {
    if (SHORT[code]) return SHORT[code];
    const full = matrix?.conditions.find((c) => c.code === code)?.label ?? code;
    return full.replace(/^(Ticket|Current|Assigned)\s+/i, "").replace(/^./, (c) => c.toUpperCase());
  }, [matrix]);
  const condFull = useCallback((code: string) => matrix?.conditions.find((c) => c.code === code)?.label ?? code, [matrix]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: { category: string; items: PermMatrix["permissions"] }[] = [];
    for (const p of matrix?.permissions ?? []) {
      if (needle && ![p.name, p.description ?? "", p.code].some((v) => v.toLowerCase().includes(needle))) continue;
      let g = out.find((x) => x.category === p.category);
      if (!g) { g = { category: p.category, items: [] }; out.push(g); }
      g.items.push(p);
    }
    const rank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? CATEGORY_ORDER.length : i; };
    return out.sort((a, b) => rank(a.category) - rank(b.category));
  }, [matrix, q]);

  const describe = (s: string[]) => {
    const m = modeOf(s);
    return m === "none" ? "No access" : m === "always" ? "Always" : "only when " + s.map(condLabel).join(" or ");
  };

  const review = useMemo(() => {
    if (!matrix) return [];
    return matrix.roles.map((r) => ({
      role: r,
      rows: matrix.permissions.flatMap((p) => {
        const s = staged[key(r.code, p.code)];
        return s ? [{ perm: p, now: s, was: orig(r.code, p.code) }] : [];
      }),
    })).filter((g) => g.rows.length > 0);
  }, [matrix, staged, orig]);

  async function confirmSave() {
    const changes: PermChange[] = [];
    for (const [k, target] of Object.entries(staged)) {
      const [role, permission] = k.split("|");
      const was = orig(role, permission);
      for (const c of target) if (!was.includes(c)) changes.push({ role, permission, condition: c, action: "GRANT" });
      for (const c of was) if (!target.includes(c)) changes.push({ role, permission, condition: c, action: "REVOKE" });
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.put<PermChangeResult>("/api/admin/permissions", { changes });
      setMatrix(res.matrix);
      setStaged({});
      setReviewing(false);
      toast("Permissions updated");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !allowed) {
    return (
      <main className="page page-narrow">
        <div className="empty panel">
          <Icon name="lock" />
          <h3>You don&apos;t have access to this page</h3>
          <p>Managing roles and permissions needs the &ldquo;Manage roles and permissions&rdquo; permission. Ask a system administrator if you need it.</p>
        </div>
      </main>
    );
  }

  const popPerm = pop && matrix?.permissions.find((x) => x.code === pop.perm);
  const popRole = pop && matrix?.roles.find((x) => x.code === pop.role);

  return (
    <main className="page perm-page">
      <div className="page-head">
        <div>
          <h1>Roles &amp; Permissions</h1>
          <p className="sub">Choose what each role can do. Conditional grants apply only when the person has that relationship to the ticket.</p>
        </div>
        {tab === "matrix" && (
          <div className="head-actions">
            <label className="local-search">
              <Icon name="search" size="sm" />
              <input type="search" placeholder="Search permissions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search permissions" />
            </label>
          </div>
        )}
      </div>

      <div className="perm-tabs">
        <div className="seg" role="group" aria-label="Permissions Center sections">
          <button type="button" aria-pressed={tab === "matrix"} onClick={() => setTab("matrix")}>Permission matrix</button>
          <button type="button" aria-pressed={tab === "roles"} onClick={() => setTab("roles")}>Roles</button>
          {canUsers && <button type="button" aria-pressed={tab === "users"} onClick={() => setTab("users")}>User roles</button>}
        </div>
      </div>

      {loadError ? (
        <div className="empty panel"><h3>Permissions didn&apos;t load</h3><p>{loadError}</p><button className="btn" type="button" onClick={load}>Try again</button></div>
      ) : !matrix ? (
        <RowsSkeleton rows={8} />
      ) : tab === "roles" ? (
        <RolesTab roles={matrix.roles} onChanged={load} />
      ) : tab === "users" ? (
        <UserRolesTab roles={matrix.roles} canAssign={can("USER_ASSIGN_ROLES")} meId={me?.id} onChanged={load} />
      ) : (
        <>
          <ul className="perm-legend" aria-label="Legend">
            <li><span className="perm-none" aria-hidden="true">–</span>No access</li>
            <li><span className="perm-always"><Icon name="check" size="xs" />Always</span>The role can always do this</li>
            <li><span className="perm-chip">Assignee</span>Only when the person has that relationship to the ticket</li>
            <li><span className="perm-dot" aria-hidden="true" />Changed, not saved yet</li>
          </ul>

          <div className="perm-scroll">
            <table className="perm-matrix">
              <thead>
                <tr>
                  <th scope="col" className="perm-corner">Permission</th>
                  {matrix.roles.map((r) => (
                    <th key={r.code} scope="col" title={r.description ?? undefined}>
                      <span className="perm-role-name">{r.name}</span>
                      <span className="perm-role-meta">{r.activeUsers} {r.activeUsers === 1 ? "user" : "users"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr><td className="perm-empty" colSpan={matrix.roles.length + 1}>No permissions match &ldquo;{q}&rdquo;.</td></tr>
                )}
                {groups.map((g) => (
                  <Fragment key={g.category}>
                    <tr className="perm-group"><th scope="colgroup" colSpan={matrix.roles.length + 1}><span>{categoryName(g.category)}</span></th></tr>
                    {g.items.map((p) => (
                      <tr key={p.code}>
                        <th scope="row" className="perm-name">
                          <b>{p.name}</b>
                          {p.description && <span>{p.description}</span>}
                        </th>
                        {matrix.roles.map((r) => {
                          const cur = current(r.code, p.code);
                          const m = modeOf(cur);
                          const changed = key(r.code, p.code) in staged;
                          return (
                            <td key={r.code} className={"perm-cell" + (changed ? " changed" : "")}>
                              <button
                                type="button"
                                className="perm-btn"
                                aria-haspopup="dialog"
                                aria-expanded={pop?.role === r.code && pop.perm === p.code}
                                aria-label={`${r.name}, ${p.name}: ${describe(cur)}${changed ? " (changed)" : ""}`}
                                data-cell={key(r.code, p.code)}
                                onClick={(e) => setPop({ role: r.code, perm: p.code, rect: e.currentTarget.getBoundingClientRect() })}
                              >
                                {m === "none" && <span className="perm-none" aria-hidden="true">–</span>}
                                {m === "always" && <span className="perm-always"><Icon name="check" size="xs" />Always</span>}
                                {m === "cond" && <span className="perm-chips">{cur.map((c) => <span key={c} className="perm-chip">{condLabel(c)}</span>)}</span>}
                                {changed && <span className="perm-dot" aria-hidden="true" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pop && popPerm && popRole && (
        <CellMenu
          key={pop.role + "|" + pop.perm}
          anchor={pop.rect}
          title={`${popRole.name} · ${popPerm.name}`}
          value={current(pop.role, pop.perm)}
          allowed={popPerm.allowedConditions}
          label={condFull}
          onChange={(v) => setCell(pop.role, pop.perm, v)}
          onClose={() => {
            setPop(null);
            document.querySelector<HTMLElement>(`[data-cell="${key(pop.role, pop.perm)}"]`)?.focus();
          }}
        />
      )}

      {dirtyCount > 0 && (
        <div className="perm-bar" role="region" aria-label="Unsaved changes">
          <span className="perm-bar-count"><span className="perm-dot" aria-hidden="true" /><b className="num">{dirtyCount}</b> unsaved {dirtyCount === 1 ? "change" : "changes"}</span>
          <div className="perm-bar-actions">
            <button className="btn ghost" type="button" onClick={() => { setStaged({}); setPop(null); }}>Reset changes</button>
            <button className="btn primary" type="button" onClick={() => { setSaveError(null); setReviewing(true); }}>Review &amp; save</button>
          </div>
        </div>
      )}

      <Modal
        open={reviewing}
        onClose={() => { if (!saving) setReviewing(false); }}
        title="Review changes"
        description={`${dirtyCount} ${dirtyCount === 1 ? "change" : "changes"} will take effect for everyone with these roles.`}
        wide
        footer={<>
          <button className="btn ghost" type="button" onClick={() => setReviewing(false)} disabled={saving}>Back</button>
          <button className={"btn primary" + (saving ? " is-busy" : "")} type="button" onClick={confirmSave} disabled={saving}>{saving && <Spinner />}{saving ? "Saving…" : "Save changes"}</button>
        </>}
      >
        <div className="perm-review">
          {review.map((g) => (
            <section key={g.role.code}>
              <h4>{g.role.name}</h4>
              <ul>
                {g.rows.map((x) => (
                  <li key={x.perm.code}>
                    <b>{x.perm.name}</b> — now {modeOf(x.now) === "cond" ? describe(x.now) : describe(x.now).toLowerCase()}{" "}
                    <span className="perm-was">(was: {describe(x.was)})</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {saveError && <p className="err" role="alert"><Icon name="alert" size="sm" />{saveError}</p>}
        </div>
      </Modal>
    </main>
  );
}

function CellMenu({ anchor, title, value, allowed, label, onChange, onClose }: {
  anchor: DOMRect;
  title: string;
  value: string[];
  allowed: string[];
  label: (c: string) => string;
  onChange: (v: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const name = useId();
  const [mode, setMode] = useState(modeOf(value));
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8));
    const below = anchor.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, anchor.top - h - 6) : below;
    setStyle({ left, top });
    el.querySelector<HTMLElement>("input:checked")?.focus();
  }, [anchor]);

  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) closeRef.current(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    const away = () => closeRef.current();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
    };
  }, []);

  const conds = value.filter((c) => c !== ALWAYS);
  const pick = (m: "none" | "always" | "cond") => {
    setMode(m);
    if (m === "none") onChange([]);
    else if (m === "always") onChange([ALWAYS]);
    else onChange(conds);
  };
  const toggle = (c: string) => onChange(conds.includes(c) ? conds.filter((x) => x !== c) : [...conds, c]);

  return (
    <div ref={ref} className="perm-pop" style={style} role="dialog" aria-label={title}>
      <p className="perm-pop-title">{title}</p>
      <label className="perm-opt"><input type="radio" name={name} checked={mode === "none"} onChange={() => pick("none")} /><span>No access</span></label>
      <label className="perm-opt"><input type="radio" name={name} checked={mode === "always"} onChange={() => pick("always")} /><span>Always</span></label>
      {allowed.length > 0 && (
        <>
          <label className="perm-opt"><input type="radio" name={name} checked={mode === "cond"} onChange={() => pick("cond")} /><span>Only when…</span></label>
          {mode === "cond" && (
            <div className="perm-conds">
              {allowed.map((c) => (
                <label key={c} className="perm-opt sub">
                  <input type="checkbox" className="checkbox" checked={conds.includes(c)} onChange={() => toggle(c)} /><span>{label(c)}</span>
                </label>
              ))}
              {conds.length === 0 && <p className="perm-hint">Pick at least one, otherwise this means no access.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
