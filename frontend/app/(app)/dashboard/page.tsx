"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, ApiError, type ModuleView } from "@/lib/api";
import { PERIODS, type DashboardData, type Rate } from "@/lib/dashboard";
import { useSession } from "@/lib/session";
import {
  ENV_LABEL, PRIORITIES, PRIORITY_LABEL, STATUS_CLASS, STATUS_LABEL, TYPE_LABEL, WORKFLOW, fmtDate, isArabic, relTime,
  type Environment, type Priority, type Status, type TicketType,
} from "@/lib/tickets";
import { Avatar, Icon, type IconName } from "@/components/Icon";
import { DashboardSkeleton, PageHeadSkeleton } from "@/components/Skeletons";
import { StatusBadge, TicketCardView } from "@/components/TicketBits";

const OPEN_STATUSES: Status[] = [...WORKFLOW.filter((s) => s !== "CLOSED"), "BLOCKED"];
const ENVIRONMENTS = Object.keys(ENV_LABEL) as Environment[];
const PIPELINE: Status[] = WORKFLOW.filter((s) => s !== "CLOSED");

const nf = new Intl.NumberFormat("en-GB");
const num = (n: number) => nf.format(n);
const pct = (r: number | null) => (r === null ? "—" : Math.round(r * 100) + "%");
const statusVar = (s: Status) => "var(--" + STATUS_CLASS[s].replace(/^s-/, "st-") + ")";

export default function DashboardPage() {
  return <Suspense><Dashboard /></Suspense>;
}

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, loading: sessionLoading, can } = useSession();
  const allowed = can("DASHBOARD_VIEW");

  const days = PERIODS.some((p) => p.days === Number(params.get("days"))) ? Number(params.get("days")) : 90;
  const moduleParam = params.get("module");
  const moduleId = moduleParam && /^\d+$/.test(moduleParam) ? Number(moduleParam) : null;
  const envParam = params.get("environment");
  const env = ENVIRONMENTS.find((e) => e === envParam) ?? null;
  const prioParam = params.get("priority");
  const prio = PRIORITIES.find((p) => p === prioParam) ?? null;

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    if (!allowed) return;
    api.get<ModuleView[]>("/api/modules?includeInactive=false").then(setModules).catch(() => {});
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    const mine = ++run.current;
    setBusy(true);
    setError(null);
    const qs = new URLSearchParams({ days: String(days) });
    if (moduleId !== null) qs.set("module", String(moduleId));
    if (env) qs.set("environment", env);
    if (prio) qs.set("priority", prio);
    api.get<DashboardData>("/api/dashboard?" + qs.toString())
      .then((d) => { if (run.current === mine) setData(d); })
      .catch((e) => { if (run.current === mine) setError(e instanceof ApiError ? e.message : "Couldn't load the dashboard."); })
      .finally(() => { if (run.current === mine) setBusy(false); });
  }, [allowed, days, moduleId, env, prio, tick]);

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value === null) sp.delete(key); else sp.set(key, value);
    const qs = sp.toString();
    router.replace(qs ? "?" + qs : "/dashboard", { scroll: false });
  }

  if (sessionLoading || !me) return <main className="page dash"><PageHeadSkeleton /><DashboardSkeleton /></main>;

  if (!allowed) {
    return (
      <main className="page">
        <div className="panel"><div className="empty">
          <Icon name="lock" />
          <h3>You don&apos;t have access to the dashboard</h3>
          <p>Ask an administrator to grant the “View dashboard” permission to your role.</p>
          <Link className="btn" href="/tickets">Go to All Tickets</Link>
        </div></div>
      </main>
    );
  }

  const period = PERIODS.find((p) => p.days === days) ?? PERIODS[1];

  // Drill-down links reuse the All Tickets URL filters.
  const filters = [
    ...(moduleId !== null ? ["module=" + moduleId] : []),
    ...(env ? ["environment=" + env] : []),
    ...(prio ? ["priority=" + prio] : []),
  ];
  const link = (...q: string[]) => "/tickets?" + [...q, ...filters].join("&");
  const filtered = filters.length > 0;
  const openQ = OPEN_STATUSES.map((s) => "status=" + s);
  const since = data ? new Date(data.from).toLocaleDateString("en-CA") : "";

  return (
    <main className="page dash">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="sub">
            Where tickets stand across the port&apos;s systems
            {data && <> · updated {relTime(data.generatedAt)}</>}
          </p>
        </div>
      </div>

      <div className="dash-filters" role="group" aria-label="Dashboard filters">
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" aria-pressed={days === p.days} title={"Last " + p.long}
              onClick={() => setParam("days", p.days === 90 ? null : String(p.days))}>{p.label}</button>
          ))}
        </div>
        <select className="select dash-module" aria-label="Module" value={moduleId ?? ""}
          onChange={(e) => setParam("module", e.target.value || null)}>
          <option value="">All modules</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="select dash-module" aria-label="Environment" value={env ?? ""}
          onChange={(e) => setParam("environment", e.target.value || null)}>
          <option value="">All environments</option>
          {ENVIRONMENTS.map((e) => <option key={e} value={e}>{ENV_LABEL[e]}</option>)}
        </select>
        <select className="select dash-module" aria-label="Priority" value={prio ?? ""}
          onChange={(e) => setParam("priority", e.target.value || null)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        {filtered && (
          <button className="clear-link" type="button"
            onClick={() => { const sp = new URLSearchParams(params.toString()); ["module", "environment", "priority"].forEach((k) => sp.delete(k)); const qs = sp.toString(); router.replace(qs ? "?" + qs : "/dashboard", { scroll: false }); }}>
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="panel dash-error" role="alert">
          <Icon name="alert" />
          <div><strong>Couldn&apos;t load the dashboard</strong><span>{error}</span></div>
          <button className="btn sm" type="button" onClick={() => setTick((t) => t + 1)}>Try again</button>
        </div>
      )}

      {!data && !error && <DashboardSkeleton />}

      {data && (
        <div className={"dash-grid" + (busy ? " is-busy" : "")} aria-busy={busy}>
          <section className="dash-kpis" aria-label="Key figures">
            <Kpi icon="ticket" label="Total tickets" value={data.kpis.total} foot={"Created in last " + period.long}
              href={link("createdFrom=" + since)} />
            <Kpi icon="inbox" label="Open" value={data.kpis.open} foot="Not started yet" href={link("status=OPEN")} />
            <Kpi icon="clock" label="In progress" value={data.kpis.inProgress} foot="Being worked on" href={link("status=IN_PROGRESS")} />
            <Kpi icon="checks" label="Testing" value={data.kpis.testing} foot="Being verified" href={link("status=TESTING")} />
            <Kpi icon="blocked" label="Blocked" value={data.kpis.blocked} tone={data.kpis.blocked > 0 ? "danger" : undefined}
              foot="Waiting on something" href={link("status=BLOCKED")} />
            <Kpi icon="checkCircle" label="Closed" value={data.kpis.closed} tone="good" foot={"Closed in last " + period.long}
              href={link("status=CLOSED", "closedFrom=" + since)} />
          </section>

          <section className="panel dash-queue">
            <div className="panel-head">
              <h3>Needs your action</h3>
              {data.myQueue.length > 0 && <span className="dash-count">{data.myQueue.length}</span>}
            </div>
            {data.myQueue.length === 0 ? (
              <div className="dash-empty">
                <Icon name="checks" />
                <strong>Nothing waiting on you</strong>
                <span>Tickets that need your review, test, verification or work will show up here.</span>
              </div>
            ) : (
              <ul className="dash-queue-list">
                {data.myQueue.map(({ ticket: t, reason }) => (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.id}`} className="dash-q-row">
                      <span className={"dash-pdot " + t.priority.toLowerCase()} title={PRIORITY_LABEL[t.priority] + " priority"} />
                      <span className="dash-q-main">
                        <span className="dash-q-top"><b>TKT-{t.id}</b><em>{reason}</em></span>
                        <span className={"dash-q-title" + (isArabic(t.title) ? " ar" : "")} dir="auto">{t.title}</span>
                      </span>
                      <StatusBadge status={t.status} closure={t.closure} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="dash-panel-foot"><Link href="/tickets/mine">All my tickets <Icon name="arrowRight" size="xs" /></Link></div>
          </section>

          <section className="panel dash-trend">
            <div className="panel-head">
              <h3>Created vs closed</h3>
              <div className="dash-legend">
                <span><i style={{ background: "var(--blue)" }} />Created</span>
                <span><i style={{ background: "var(--st-closed)" }} />Closed</span>
              </div>
            </div>
            <div className="panel-body"><TrendChart trend={data.trend} periodLabel={period.long} /></div>
          </section>

          <section className="panel dash-pipeline">
            <div className="panel-head">
              <h3>Status pipeline</h3>
              <span className="dash-muted">{num(data.totals.open)} open</span>
            </div>
            <div className="panel-body"><Pipeline data={data} link={link} /></div>
          </section>

          <section className="panel dash-third">
            <div className="panel-head"><h3>By priority</h3><span className="dash-muted">open</span></div>
            <div className="panel-body">
              <BarList rows={PRIORITIES.map((p) => ({
                key: p, label: PRIORITY_LABEL[p], value: data.byPriority[p] ?? 0,
                color: "var(--p-" + p.toLowerCase() + ")", href: link("priority=" + p, ...openQ),
              }))} />
            </div>
          </section>

          <section className="panel dash-third">
            <div className="panel-head"><h3>By module</h3><span className="dash-muted">open · top 8</span></div>
            <div className="panel-body">
              {data.byModule.length === 0 ? <p className="dash-none">No open tickets.</p> : (
                <BarList rows={data.byModule.slice(0, 8).map((m) => ({
                  key: String(m.module.id), label: m.module.name, value: m.count, color: "var(--blue)",
                  href: "/tickets?" + ["module=" + m.module.id, ...openQ].join("&"),
                }))} />
              )}
            </div>
          </section>

          <section className="panel dash-third">
            <div className="panel-head"><h3>By assignee</h3><span className="dash-muted">open · top 8</span></div>
            <div className="panel-body">
              {data.byAssignee.top.length === 0 && data.byAssignee.unassigned === 0 ? <p className="dash-none">No open tickets.</p> : (
                <BarList rows={[
                  ...data.byAssignee.top.map((a) => ({
                    key: String(a.person.id), label: a.person.fullName, value: a.count, color: "var(--navy)",
                    lead: <Avatar name={a.person.fullName} color={a.person.avatarColor} size="xs" />,
                    href: link("assignee=" + a.person.id, ...openQ),
                  })),
                  ...(data.byAssignee.unassigned > 0 ? [{
                    key: "none", label: "Unassigned", value: data.byAssignee.unassigned, color: "var(--perf)",
                    lead: <span className="avatar unassigned xs"><Icon name="user" size="xs" /></span>,
                    href: link("assignee=0", ...openQ),
                  }] : []),
                ]} />
              )}
            </div>
          </section>

          <section className="panel dash-third">
            <div className="panel-head"><h3>Type &amp; environment</h3><span className="dash-muted">open</span></div>
            <div className="panel-body dash-splits">
              <Split title="Type" total={data.totals.open} parts={(Object.keys(TYPE_LABEL) as TicketType[]).map((k) => ({
                key: k, label: TYPE_LABEL[k], value: data.byType[k] ?? 0, color: k === "BUG" ? "var(--st-blocked)" : "var(--blue)",
                href: link("type=" + k, ...openQ),
              }))} />
              <Split title="Environment" total={data.totals.open} parts={(Object.keys(ENV_LABEL) as Environment[]).map((k) => ({
                key: k, label: ENV_LABEL[k], value: data.byEnvironment[k] ?? 0, color: k === "PRODUCTION" ? "#D9572A" : "var(--st-deployed)",
                href: link("environment=" + k, ...openQ),
              }))} />
            </div>
          </section>

          <section className="panel dash-wide">
            <div className="panel-head"><h3>Quality &amp; cycle time</h3><span className="dash-muted">Last {period.long}</span></div>
            <div className="panel-body dash-quality">
              <Meter label="Review rejection" r={data.quality.reviewRejection} noun="reviews" verb="rejected" />
              <Meter label="Test failure" r={data.quality.testFailure} noun="test runs" verb="failed" />
              <Meter label="Verification failure" r={data.quality.verificationFailure} noun="verifications" verb="failed" />
              <div className="dash-cycle">
                <div className="dash-meter-label">Time to resolve</div>
                <div className="dash-cycle-grid">
                  <div><b>{data.cycle.medianDays === null ? "—" : data.cycle.medianDays}</b><span>median days</span></div>
                  <div><b>{data.cycle.averageDays === null ? "—" : data.cycle.averageDays}</b><span>average days</span></div>
                </div>
                <div className="dash-meter-raw">
                  {data.cycle.count === 0 ? "No tickets resolved in this period" : `Across ${num(data.cycle.count)} resolved ticket${data.cycle.count === 1 ? "" : "s"}`}
                </div>
              </div>
            </div>
          </section>

          <section className="dash-recent" aria-labelledby="dash-recent-h">
            <div className="dash-recent-head">
              <h2 id="dash-recent-h">Recent tickets</h2>
              <Link href={link()}>View all tickets <Icon name="arrowRight" size="xs" /></Link>
            </div>
            {data.recent.length === 0 ? (
              <div className="panel"><div className="dash-empty">
                <Icon name="ticket" />
                <strong>No tickets match these filters</strong>
                <span>{filtered ? "Clear a filter to see more." : "New tickets will appear here."}</span>
              </div></div>
            ) : (
              <div className="ticket-grid">
                {data.recent.map((t) => <TicketCardView key={t.id} t={t} />)}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

/* ---------- Pieces ---------- */

function Kpi({ icon, label, value, foot, href, tone }: {
  icon: IconName; label: string; value: number; foot: string; href: string; tone?: "danger" | "warn" | "good";
}) {
  return (
    <Link href={href} className={"dash-kpi" + (tone ? " " + tone : "")}>
      <span className="dash-kpi-top">
        <span className="dash-kpi-label">{label}</span>
        <span className="dash-kpi-icon"><Icon name={icon} size="sm" /></span>
      </span>
      <span className="dash-kpi-value">{num(value)}</span>
      <span className="dash-kpi-foot">{foot}</span>
    </Link>
  );
}

interface BarRow { key: string; label: string; value: number; color: string; href?: string; lead?: React.ReactNode }

function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="dash-bars">
      {rows.map((r) => {
        const body = (
          <>
            {r.lead}
            <span className="dash-bar-label" dir="auto" title={r.label}>{r.label}</span>
            <span className="dash-bar-track"><span className="dash-bar-fill" style={{ width: (r.value / max) * 100 + "%", background: r.color }} /></span>
            <b className="dash-bar-val">{num(r.value)}</b>
          </>
        );
        return <li key={r.key}>{r.href ? <Link href={r.href} className="dash-bar">{body}</Link> : <div className="dash-bar">{body}</div>}</li>;
      })}
    </ul>
  );
}

function Split({ title, parts, total }: { title: string; total: number; parts: { key: string; label: string; value: number; color: string; href: string }[] }) {
  const sum = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="dash-split">
      <div className="dash-meter-label">{title}</div>
      <div className="dash-split-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {sum === 0 ? <span className="dash-split-empty" /> : parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ flexGrow: p.value, background: p.color }} />
        ))}
      </div>
      <ul className="dash-split-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <Link href={p.href}><i style={{ background: p.color }} />{p.label}<b>{num(p.value)}</b>
              <small>{total ? Math.round((p.value / total) * 100) + "%" : "—"}</small></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pipeline({ data, link }: { data: DashboardData; link: (...q: string[]) => string }) {
  const counts = PIPELINE.map((s) => ({ s, n: data.totals.byStatus[s] ?? 0 }));
  const total = counts.reduce((a, c) => a + c.n, 0);
  const blocked = data.totals.byStatus.BLOCKED ?? 0;
  return (
    <div className="dash-pipe">
      <div className="dash-pipe-bar" aria-hidden="true">
        {total + blocked === 0 && <span className="dash-split-empty" />}
        {counts.filter((c) => c.n > 0).map((c) => (
          <Link key={c.s} tabIndex={-1} href={link("status=" + c.s)} title={`${STATUS_LABEL[c.s]}: ${c.n}`}
            style={{ flexGrow: c.n, background: statusVar(c.s) }} />
        ))}
        {blocked > 0 && <Link tabIndex={-1} className="blocked-seg" href={link("status=BLOCKED")} title={`Blocked: ${blocked}`}
          style={{ flexGrow: blocked, background: statusVar("BLOCKED") }} />}
      </div>
      <ol className="dash-pipe-steps">
        {counts.map((c, i) => (
          <li key={c.s}>
            <Link href={link("status=" + c.s)} style={{ ["--c" as string]: statusVar(c.s) }}>
              <span className="dash-step-n">{i + 1}</span>
              <b>{num(c.n)}</b>
              <span>{STATUS_LABEL[c.s]}</span>
            </Link>
          </li>
        ))}
        <li className="dash-pipe-side">
          <Link href={link("status=BLOCKED")} style={{ ["--c" as string]: statusVar("BLOCKED") }}>
            <span className="dash-step-n"><Icon name="blocked" size="xs" /></span>
            <b>{num(blocked)}</b>
            <span>Blocked</span>
          </Link>
        </li>
      </ol>
    </div>
  );
}

function Meter({ label, r, noun, verb }: { label: string; r: Rate; noun: string; verb: string }) {
  const total = r.bad + r.good;
  const tone = r.rate === null ? "none" : r.rate >= 0.4 ? "high" : r.rate >= 0.2 ? "mid" : "low";
  return (
    <div className="dash-meter">
      <div className="dash-meter-label">{label}</div>
      <div className="dash-meter-val">{pct(r.rate)}</div>
      <div className="dash-meter-track" role="img" aria-label={r.rate === null ? label + ": no data" : `${label}: ${pct(r.rate)}`}>
        <span className={"dash-meter-fill " + tone} style={{ width: r.rate === null ? 0 : Math.max(r.rate * 100, r.rate > 0 ? 3 : 0) + "%" }} />
      </div>
      <div className="dash-meter-raw">{total === 0 ? "No " + noun + " in this period" : `${num(r.bad)} of ${num(total)} ${noun} ${verb}`}</div>
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function TrendChart({ trend, periodLabel }: { trend: DashboardData["trend"]; periodLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 250, L = 36, R = 14, T = 12, B = 30;
  const n = trend.length;
  const max = niceMax(Math.max(0, ...trend.flatMap((w) => [w.created, w.closed])));
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (k: "created" | "closed") => trend.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(w[k]).toFixed(1)}`).join(" ");
  const area = n ? `${line("created")} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const step = Math.max(1, Math.ceil(n / 8));
  const label = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const totalCreated = trend.reduce((a, w) => a + w.created, 0);
  const totalClosed = trend.reduce((a, w) => a + w.closed, 0);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = n <= 1 ? 0 : Math.round(((px - L) / (W - L - R)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const h = hover !== null ? trend[hover] : null;
  return (
    <div className="dash-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="trend-t trend-d" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <title id="trend-t">Tickets created and closed per week</title>
        <desc id="trend-d">{`Weekly line chart over the last ${periodLabel}: ${totalCreated} tickets created and ${totalClosed} closed in total.`}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        {trend.map((w, i) => i % step === 0 && (
          <text key={w.weekStart} x={x(i)} y={H - 8} textAnchor="middle" className="axis">{label(w.weekStart)}</text>
        ))}
        {n > 0 && <path d={area} className="area" />}
        {n > 0 && <path d={line("created")} className="ln created" />}
        {n > 0 && <path d={line("closed")} className="ln closed" />}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cursor" />
            <circle cx={x(hover)} cy={y(h.created)} r="4" className="pt created" />
            <circle cx={x(hover)} cy={y(h.closed)} r="4" className="pt closed" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="dash-tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
          <b>Week of {label(h.weekStart)}</b>
          <span><i style={{ background: "var(--blue)" }} />Created <em>{h.created}</em></span>
          <span><i style={{ background: "var(--st-closed)" }} />Closed <em>{h.closed}</em></span>
        </div>
      )}
      <table className="sr-only">
        <caption>Tickets created and closed per week</caption>
        <thead><tr><th>Week of</th><th>Created</th><th>Closed</th></tr></thead>
        <tbody>{trend.map((w) => <tr key={w.weekStart}><td>{fmtDate(w.weekStart)}</td><td>{w.created}</td><td>{w.closed}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
