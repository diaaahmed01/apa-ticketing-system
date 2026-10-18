"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type ModuleView } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Icon } from "./Icon";
import { Person, PriorityBadge, StatusBadge, TicketCardView, TypeLabel } from "./TicketBits";
import {
  CLOSURE_LABEL, ENV_LABEL, PRIORITY_LABEL, PRIORITIES, STATUS_LABEL, TYPE_LABEL, WORKFLOW, fmtDate, isArabic,
  type DirectoryEntry, type PageOf, type TicketCard,
} from "@/lib/tickets";

type Opt = [string, string];
interface FilterDef { key: string; label: string; options: Opt[]; search?: boolean; render?: (v: string) => React.ReactNode }

const PAGE = 30;
const LIST_KEYS = ["status", "priority", "module", "assignee", "environment", "type", "creator", "reviewer", "tester", "closure"];

/** All Tickets and My Tickets. Filters live in the URL so a filtered view can be bookmarked or shared. */
export function TicketList({ mine }: { mine: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useSession();

  const [view, setView] = useState<"tickets" | "table">("tickets");
  const [data, setData] = useState<PageOf<TicketCard> | null>(null);
  const [extra, setExtra] = useState<TicketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<DirectoryEntry[]>([]);
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(() => ["creator", "reviewer", "tester", "closure", "hasPatch"].some((k) => params.has(k)));
  const anchor = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("ats-view"); if (v === "table" || v === "tickets") setView(v); } catch { /* ignore */ }
    api.get<DirectoryEntry[]>("/api/users/directory").then(setPeople).catch(() => {});
    api.get<ModuleView[]>("/api/modules?includeInactive=false").then(setModules).catch(() => {});
  }, []);

  const query = useMemo(() => {
    const sp = new URLSearchParams(params.toString());
    if (mine) sp.set("mine", "true");
    sp.set("size", String(PAGE));
    return sp;
  }, [params, mine]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExtra([]);
    try {
      setData(await api.get<PageOf<TicketCard>>("/api/tickets?" + query.toString()));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load tickets.");
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  // Debounced search into the URL.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => setParam("q", q.trim() ? [q.trim()] : []), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, values: string[]) {
    const sp = new URLSearchParams(params.toString());
    sp.delete(key);
    values.forEach((v) => sp.append(key, v));
    sp.delete("page");
    router.replace("?" + sp.toString(), { scroll: false });
  }

  async function loadMore() {
    if (!data) return;
    const next = new URLSearchParams(query.toString());
    const nextPage = data.page + 1 + Math.floor(extra.length / PAGE);
    next.set("page", String(nextPage));
    try {
      const more = await api.get<PageOf<TicketCard>>("/api/tickets?" + next.toString());
      setExtra((x) => [...x, ...more.items]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load more tickets.");
    }
  }

  const items = [...(data?.items ?? []), ...extra];
  const personOpts: Opt[] = people.map((p) => [String(p.id), p.fullName]);
  const defs: FilterDef[] = [
    { key: "status", label: "Status", options: [...WORKFLOW, "BLOCKED" as const].map((s) => [s, STATUS_LABEL[s]]), render: (v) => <StatusBadge status={v as "OPEN"} /> },
    { key: "priority", label: "Priority", options: PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]]), render: (v) => <PriorityBadge level={v as "LOW"} /> },
    { key: "module", label: "Module", options: modules.map((m) => [String(m.id), m.name]) },
    { key: "assignee", label: "Assignee", options: [["0", "Unassigned"], ...personOpts], search: true },
    { key: "environment", label: "Environment", options: Object.entries(ENV_LABEL) as Opt[] },
    { key: "type", label: "Type", options: Object.entries(TYPE_LABEL) as Opt[] },
  ];
  const advDefs: FilterDef[] = [
    { key: "creator", label: "Created by", options: personOpts, search: true },
    { key: "reviewer", label: "Reviewer", options: personOpts, search: true },
    { key: "tester", label: "Tester", options: personOpts, search: true },
    { key: "closure", label: "Closure result", options: Object.entries(CLOSURE_LABEL) as Opt[] },
  ];
  const allDefs = [...defs, ...advDefs];
  const openDef = allDefs.find((d) => d.key === openKey);
  const hasFilters = LIST_KEYS.some((k) => params.has(k)) || params.has("q") || params.has("hasPatch") || params.has("createdFrom") || params.has("createdTo") || params.has("closedFrom") || params.has("closedTo");

  function chip(d: FilterDef) {
    const sel = params.getAll(d.key);
    const label = sel.length === 1
      ? <>{d.label}: <span className="val">{d.options.find((o) => o[0] === sel[0])?.[1] ?? "…"}</span></>
      : sel.length > 1 ? <>{d.label} <span className="n">{sel.length}</span></> : d.label;
    return (
      <button
        key={d.key}
        type="button"
        className={"chip-select" + (sel.length ? " on" : "")}
        aria-expanded={openKey === d.key}
        onClick={(e) => { anchor.current = e.currentTarget; setOpenKey(openKey === d.key ? null : d.key); }}
      >
        {label}<Icon name="chevDown" size="xs" />
      </button>
    );
  }

  const dateSet = params.has("createdFrom") || params.has("createdTo");
  const closedSet = params.has("closedFrom") || params.has("closedTo");

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{mine ? "My Tickets" : "All Tickets"}</h1>
          <p className="sub">{mine
            ? "Tickets you raised, are assigned to, review, test or collaborate on."
            : "Every issue raised between the port support team and HQ."}</p>
        </div>
        <div className="head-actions">
          <div className="seg" role="group" aria-label="Display mode">
            {(["tickets", "table"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); try { localStorage.setItem("ats-view", v); } catch { /* ignore */ } }}>
                <Icon name={v === "tickets" ? "ticket" : "table"} size="sm" />{v === "tickets" ? "Tickets" : "Table"}
              </button>
            ))}
          </div>
          {can("TICKET_CREATE") && <Link className="btn primary" href="/tickets/new"><Icon name="plus" size="sm" /><span>Create ticket</span></Link>}
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-row">
          <label className="local-search">
            <Icon name="search" size="sm" />
            <input type="search" placeholder="Search by number, title or description" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />
          </label>
          <div className="divider-v" />
          {defs.map(chip)}
          <button
            type="button"
            className={"chip-select" + (dateSet ? " on" : "")}
            onClick={(e) => { anchor.current = e.currentTarget; setOpenKey(openKey === "date" ? null : "date"); }}
          >
            <Icon name="calendar" size="xs" />{dateSet ? <>Created: <span className="val">{params.get("createdFrom") ?? "…"} → {params.get("createdTo") ?? "now"}</span></> : "Created"}<Icon name="chevDown" size="xs" />
          </button>
          {closedSet && (
            <button
              type="button"
              className="chip-select on"
              title="Remove the closed-date filter"
              aria-label={`Remove closed-date filter: ${params.get("closedFrom") ?? "…"} to ${params.get("closedTo") ?? "now"}`}
              onClick={() => { const sp = new URLSearchParams(params.toString()); sp.delete("closedFrom"); sp.delete("closedTo"); sp.delete("page"); router.replace("?" + sp.toString(), { scroll: false }); }}
            >
              <Icon name="calendar" size="xs" />Closed: <span className="val">{params.get("closedFrom") ?? "…"} → {params.get("closedTo") ?? "now"}</span><Icon name="x" size="xs" />
            </button>
          )}
          <button className="btn ghost sm" type="button" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
            <Icon name="settings" size="sm" />Advanced filters
          </button>
        </div>
        {advanced && (
          <div className="toolbar-row adv-row">
            {advDefs.map(chip)}
            <label className="chip-select" style={{ gap: 8 }}>
              <input type="checkbox" className="checkbox" checked={params.get("hasPatch") === "true"} onChange={(e) => setParam("hasPatch", e.target.checked ? ["true"] : [])} />
              Has patch reference
            </label>
          </div>
        )}
        <div className="result-line">
          {data && <span>Showing <b>{items.length}</b> of <b>{data.total}</b> {data.total === 1 ? "ticket" : "tickets"}</span>}
          {hasFilters && (
            <button className="clear-link" type="button" onClick={() => { setQ(""); router.replace("?", { scroll: false }); }}>Clear filters</button>
          )}
          <label className="sort-sel">Sort by
            <select value={params.get("sort") ?? "NEWEST"} onChange={(e) => setParam("sort", e.target.value === "NEWEST" ? [] : [e.target.value])}>
              <option value="NEWEST">Newest first</option>
              <option value="OLDEST">Oldest first</option>
              <option value="UPDATED">Recently updated</option>
              <option value="PRIORITY">Priority</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="empty panel"><h3>Tickets didn&apos;t load</h3><p>{error}</p><button className="btn" type="button" onClick={load}>Try again</button></div>
      ) : loading && !data ? (
        <div className="ticket-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="tk-skel" />)}</div>
      ) : items.length === 0 ? (
        <EmptyTickets filtered={hasFilters} mine={mine} canCreate={can("TICKET_CREATE")} onClear={() => { setQ(""); router.replace("?", { scroll: false }); }} />
      ) : view === "tickets" ? (
        <section className="ticket-grid" aria-label="Tickets" style={loading ? { opacity: 0.6 } : undefined}>
          {items.map((t) => <TicketCardView key={t.id} t={t} />)}
        </section>
      ) : (
        <TicketTable items={items} onOpen={(id) => router.push(`/tickets/${id}`)} />
      )}

      {data && items.length < data.total && (
        <div className="load-more"><button className="btn" type="button" onClick={loadMore}>Show {Math.min(PAGE, data.total - items.length)} more</button></div>
      )}

      {openKey && openKey !== "date" && openDef && (
        <FilterPopover
          def={openDef}
          anchor={anchor.current}
          selected={params.getAll(openDef.key)}
          onChange={(v) => setParam(openDef.key, v)}
          onClose={() => setOpenKey(null)}
        />
      )}
      {openKey === "date" && (
        <DatePopover
          anchor={anchor.current}
          from={params.get("createdFrom") ?? ""}
          to={params.get("createdTo") ?? ""}
          onApply={(f, t) => {
            const sp = new URLSearchParams(params.toString());
            sp.delete("createdFrom"); sp.delete("createdTo");
            if (f) sp.set("createdFrom", f);
            if (t) sp.set("createdTo", t);
            router.replace("?" + sp.toString(), { scroll: false });
            setOpenKey(null);
          }}
          onClose={() => setOpenKey(null)}
        />
      )}
    </main>
  );
}

function usePopoverPosition(anchor: HTMLElement | null, ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const rtl = document.documentElement.dir === "rtl";
    const left = Math.max(12, Math.min(rtl ? r.right - w : r.left, innerWidth - w - 12));
    setPos({ left, top: Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 12) });
  }, [anchor, ref]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", onClose, { passive: true });
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", onClose); };
  }, [anchor, ref, onClose]);
  return pos;
}

function FilterPopover({ def, anchor, selected, onChange, onClose }: {
  def: FilterDef; anchor: HTMLElement | null; selected: string[]; onChange: (v: string[]) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(anchor, ref, onClose);
  const [find, setFind] = useState("");
  const opts = def.options.filter(([, l]) => !find || l.toLowerCase().includes(find.toLowerCase()));
  return (
    <div className="pop" ref={ref} role="dialog" aria-label={def.label + " filter"} style={pos ?? { visibility: "hidden", left: 0, top: 0 }}>
      {def.search && (
        <div className="pop-search"><Icon name="search" size="sm" /><input autoFocus placeholder="Find a person" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find option" /></div>
      )}
      {opts.length === 0 && <div className="opt-row" style={{ color: "var(--muted-2)", cursor: "default" }}>Nothing matches</div>}
      {opts.map(([v, l]) => (
        <label key={v} className="opt-row">
          <input
            type="checkbox"
            className="checkbox"
            checked={selected.includes(v)}
            onChange={(e) => onChange(e.target.checked ? [...selected, v] : selected.filter((x) => x !== v))}
          />
          {def.render ? def.render(v) : <span dir="auto">{l}</span>}
        </label>
      ))}
      <div className="pop-foot">
        <button className="clear-link" type="button" onClick={() => onChange([])}>Clear</button>
        <button className="btn sm navy" type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function DatePopover({ anchor, from, to, onApply, onClose }: {
  anchor: HTMLElement | null; from: string; to: string; onApply: (from: string, to: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(anchor, ref, onClose);
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const preset = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days + 1); onApply(iso(d), ""); };
  return (
    <div className="pop" ref={ref} role="dialog" aria-label="Created date filter" style={pos ?? { visibility: "hidden", left: 0, top: 0 }}>
      {[["Today", 1], ["Last 7 days", 7], ["Last 30 days", 30], ["Last 90 days", 90]].map(([l, d]) => (
        <button key={l} type="button" className="opt-row" style={{ width: "100%", border: 0, background: "none", font: "inherit" }} onClick={() => preset(d as number)}>{l}</button>
      ))}
      <div className="date-fields">
        <div className="field"><label htmlFor="df">From</label><input id="df" className="input" type="date" value={f} max={t || undefined} onChange={(e) => setF(e.target.value)} /></div>
        <div className="field"><label htmlFor="dt">To</label><input id="dt" className="input" type="date" value={t} min={f || undefined} onChange={(e) => setT(e.target.value)} /></div>
      </div>
      <div className="pop-foot">
        <button className="clear-link" type="button" onClick={() => onApply("", "")}>Clear</button>
        <button className="btn sm navy" type="button" onClick={() => onApply(f, t)}>Apply</button>
      </div>
    </div>
  );
}

function TicketTable({ items, onOpen }: { items: TicketCard[]; onOpen: (id: number) => void }) {
  return (
    <section className="table-wrap" aria-label="Tickets table">
      <table className="data tickets">
        <thead>
          <tr><th>Ticket ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Module</th><th>Type</th><th>Environment</th><th>Assignee</th><th>Created at</th></tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} tabIndex={0} onClick={() => onOpen(t.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(t.id); }}>
              <td><span className={"id-chip p-" + t.priority.toLowerCase()}>TKT-{t.id}</span></td>
              <td><div className={"t-title" + (isArabic(t.title) ? " ar" : "")} dir="auto" title={t.title}>{t.title}</div></td>
              <td><StatusBadge status={t.status} closure={t.closure} /></td>
              <td><PriorityBadge level={t.priority} /></td>
              <td><span className="cell-flex"><Icon name="box" size="xs" />{t.module.name}</span></td>
              <td><span className="cell-flex"><TypeLabel type={t.type} /></span></td>
              <td><span className={"tag " + (t.environment === "PRODUCTION" ? "env-prod" : "env-test")}>{t.environment ? ENV_LABEL[t.environment] : "—"}</span></td>
              <td><Person p={t.assignee} /></td>
              <td className="num" style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>{fmtDate(t.createdAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EmptyTickets({ filtered, mine, canCreate, onClear }: { filtered: boolean; mine: boolean; canCreate: boolean; onClear: () => void }) {
  return (
    <div className="empty panel">
      <svg width="120" height="64" viewBox="0 0 120 64" aria-hidden="true">
        <path d="M8 6h104a4 4 0 0 1 4 4v14a8 8 0 0 0 0 16v14a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V40a8 8 0 0 0 0-16V10a4 4 0 0 1 4-4z" fill="#fff" stroke="#C3CDD9" strokeWidth="1.5" />
        <path d="M14 32h92" stroke="#C3CDD9" strokeWidth="1.5" strokeDasharray="4 4" />
        <rect x="16" y="14" width="40" height="6" rx="3" fill="#E3E8EF" />
        <rect x="16" y="42" width="60" height="5" rx="2.5" fill="#E3E8EF" />
      </svg>
      {filtered ? (
        <>
          <h3>No tickets match these filters</h3>
          <p>Remove a filter, or search for the ticket number directly, for example <b>1001</b>.</p>
          <button className="btn" type="button" onClick={onClear}>Clear all filters</button>
        </>
      ) : (
        <>
          <h3>{mine ? "Nothing on your plate" : "No tickets yet"}</h3>
          <p>{mine ? "Tickets you raise, or that are assigned to you, will collect here." : "When someone raises an issue it appears here as a ticket."}</p>
          {canCreate && <Link className="btn primary" href="/tickets/new"><Icon name="plus" size="sm" />Create the first ticket</Link>}
        </>
      )}
    </div>
  );
}
