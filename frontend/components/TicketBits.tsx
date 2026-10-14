"use client";

import Link from "next/link";
import { Avatar, Icon } from "./Icon";
import { Perf, TicketPaper } from "./TicketPaper";
import {
  CLOSURE_LABEL, ENV_LABEL, PRIORITY_LABEL, STATUS_CLASS, STATUS_LABEL, TYPE_LABEL, fmtDate, isArabic,
  type Closure, type Environment, type PersonRef, type Priority, type Status, type TicketCard, type TicketType,
} from "@/lib/tickets";

export function StatusBadge({ status, closure }: { status: Status; closure?: Closure | null }) {
  if (status === "CLOSED" && closure) {
    const cls = closure === "CANCELLED" ? "s-cancelled" : closure === "UNRESOLVED" ? "s-blocked" : "s-closed";
    return <span className={"status " + cls}>{closure === "CANCELLED" ? "Cancelled" : "Closed · " + CLOSURE_LABEL[closure]}</span>;
  }
  return <span className={"status " + STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBars({ level }: { level: Priority }) {
  const n = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 3 }[level];
  return (
    <svg viewBox="0 0 14 12" aria-hidden="true">
      {[4, 7.5, 11].map((h, i) => (
        <rect key={i} x={i * 4.5 + 0.5} y={12 - h} width="3" height={h} rx="1" fill="currentColor" opacity={i < n ? 1 : 0.25} />
      ))}
    </svg>
  );
}

export function PriorityBadge({ level }: { level: Priority }) {
  return <span className={"prio " + level.toLowerCase()}><PriorityBars level={level} />{PRIORITY_LABEL[level]}</span>;
}

export function TypeLabel({ type }: { type: TicketType }) {
  return (
    <>
      {type === "BUG" ? (
        <svg className="icon xs" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 2 1.9 1.9M14.1 3.9 16 2M9 7.1v-1a3 3 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6 13H2M22 13h-4" /></svg>
      ) : (
        <svg className="icon xs" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M16 16h5v5" /></svg>
      )}
      <span>{TYPE_LABEL[type]}</span>
    </>
  );
}

export function EnvLabel({ env }: { env: Environment | null }) {
  if (!env) return <span className="muted">—</span>;
  return <><span className={"env-dot" + (env === "PRODUCTION" ? " prod" : "")} /><span>{ENV_LABEL[env]}</span></>;
}

/** Deterministic barcode from the ticket number: decoration that is unique per ticket. */
export function Barcode({ seed, width = 64, height = 22, className = "barcode" }: { seed: number; width?: number; height?: number; className?: string }) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < width - 2) {
    const w = rnd() > 0.62 ? 2.2 : 1;
    bars.push({ x, w });
    x += w + (rnd() > 0.55 ? 2.4 : 1.4);
  }
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => <rect key={i} x={b.x.toFixed(1)} y="0" width={b.w} height={height} fill="currentColor" />)}
    </svg>
  );
}

export function Person({ p, size = "xs", empty = "Unassigned", sub }: { p: PersonRef | null; size?: "xs" | "lg"; empty?: string; sub?: React.ReactNode }) {
  if (!p) {
    return (
      <div className="person">
        <span className={"avatar unassigned " + size}><Icon name="user" size="xs" /></span>
        <span className="name" style={{ color: "var(--muted)", fontWeight: 500 }}>{empty}</span>
      </div>
    );
  }
  return (
    <div className="person">
      <Avatar name={p.fullName} color={p.avatarColor} size={size} />
      <div style={{ minWidth: 0 }}>
        <div className="name" dir="auto">{p.fullName}</div>
        {sub && <div className="org">{sub}</div>}
      </div>
    </div>
  );
}

/** The physical ticket card used in the grid and the dashboard. */
export function TicketCardView({ t, preview }: { t: TicketCard; preview?: boolean }) {
  const closed = t.status === "CLOSED";
  const ar = isArabic(t.title);
  const inner = (
      <TicketPaper priority={t.priority.toLowerCase() as "low"} className={closed ? "is-closed" : undefined}>
        {closed && t.closure && <div className={"stamp " + t.closure.toLowerCase()}>{CLOSURE_LABEL[t.closure]}</div>}
        <div className="tk-head">
          <div className="tk-id">
            <small><TypeLabel type={t.type} /></small>
            <b><span>#TKT-</span>{t.id > 0 ? t.id : "····"}</b>
          </div>
          <div className="tk-badges">
            <PriorityBadge level={t.priority} />
            <StatusBadge status={t.status} closure={t.closure} />
          </div>
        </div>
        <div className="tk-body">
          <h3 className={"tk-title" + (ar ? " ar" : "")} dir="auto" lang={ar ? "ar" : undefined}>{t.title}</h3>
          <p className={"tk-desc" + (isArabic(t.excerpt) ? " ar" : "")} dir="auto">{t.excerpt}</p>
          <dl className="tk-fields">
            <div className="tk-f"><dt>Module</dt><dd><Icon name="box" size="xs" /><span>{t.module.name}</span></dd></div>
            <div className="tk-f"><dt>Environment</dt><dd><EnvLabel env={t.environment} /></dd></div>
          </dl>
        </div>
        <Perf />
        <div className="tk-crew">
          <div className="crew"><div className="tk-k">Assigned to</div><Person p={t.assignee} /></div>
          <div className="crew"><div className="tk-k">Assigned by</div><Person p={t.assignedBy} empty="—" /></div>
          <div className="crew"><div className="tk-k">Reviewer</div><Person p={t.reviewer} empty="—" /></div>
          <div className="crew"><div className="tk-k">Tester</div><Person p={t.tester} empty="—" /></div>
        </div>
        <div className="tk-foot">
          <Barcode seed={t.id} />
          <div className="meta"><b dir="auto">{t.creator.fullName}</b><br />{fmtDate(t.createdAt)}</div>
          {!preview && <span className="go">View details <Icon name="arrowRight" size="xs" /></span>}
        </div>
      </TicketPaper>
  );
  return preview
    ? <div className="tk-link tk-preview" aria-label="Ticket preview">{inner}</div>
    : <Link href={`/tickets/${t.id}`} className="tk-link" aria-label={`TKT-${t.id}: ${t.title}`}>{inner}</Link>;
}
