import { Fragment } from "react";
import { Perf, TicketPaper } from "./TicketPaper";

/**
 * Loading placeholders. They share one look (the `.skeleton` sweep in globals.css) and mirror the final
 * layout's classes and sizes, so nothing jumps when the real content arrives.
 */

const sk = (extra?: string) => "skeleton" + (extra ? " " + extra : "");
const w = (width: number | string) => ({ width });

export function Bone({ className, width, height, style }: { className?: string; width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className={sk(className)} style={{ width, height, ...style }} aria-hidden="true" />;
}

/** Title and subtitle bars where a page heading will be. */
export function PageHeadSkeleton({ action }: { action?: boolean }) {
  return (
    <div className="page-head" aria-hidden="true">
      <div><div className={sk("sk-h1")} /><div className={sk("sk-sub")} /></div>
      {action && <div className="head-actions"><div className={sk("sk-btn")} /></div>}
    </div>
  );
}

/** Stacked rows for lists and admin screens. */
export function RowsSkeleton({ rows = 6, panel = true, label = "Loading" }: { rows?: number; panel?: boolean; label?: string }) {
  const body = <div className="skeleton-rows">{Array.from({ length: rows }, (_, i) => <div key={i} className={sk()} />)}</div>;
  return panel
    ? <div className="panel" aria-busy="true" aria-label={label}>{body}</div>
    : <div aria-busy="true" aria-label={label}>{body}</div>;
}

/** An admin screen while it loads: heading and rows. */
export function AdminPageSkeleton({ rows = 6, action = true }: { rows?: number; action?: boolean }) {
  return <main className="page"><PageHeadSkeleton action={action} /><RowsSkeleton rows={rows} /></main>;
}

/** The ticket card's silhouette (notches and perforation included) filled with bars. */
export function TicketCardSkeleton() {
  return (
    <div className="tk-link" aria-hidden="true">
      <TicketPaper priority="low" className="tk-sk">
        <div className="tk-head">
          <div className="tk-id">
            <div className={sk("sk-line")} style={w(70)} />
            <div className={sk("sk-title")} style={{ width: 118, height: 22, marginTop: 6 }} />
          </div>
          <div className="tk-badges"><div className={sk("sk-pill")} style={w(72)} /><div className={sk("sk-pill")} style={w(92)} /></div>
        </div>
        <div className="tk-body">
          <div className="sk-stack tk-copy"><div className={sk("sk-title")} style={w("88%")} /><div className={sk("sk-title")} style={w("56%")} /></div>
          <div className="sk-stack tk-copy-2"><div className={sk("sk-line")} style={w("96%")} /><div className={sk("sk-line")} style={w("72%")} /></div>
          <dl className="tk-fields">
            <div className="tk-f"><div className={sk("sk-line")} style={{ width: 48, marginBottom: 6 }} /><div className={sk("sk-line")} style={w("70%")} /></div>
            <div className="tk-f"><div className={sk("sk-line")} style={{ width: 70, marginBottom: 6 }} /><div className={sk("sk-line")} style={w("55%")} /></div>
          </dl>
        </div>
        <Perf />
        <div className="tk-crew">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="crew">
              <div className={sk("sk-line")} style={{ width: 62, marginBottom: 7 }} />
              <div className="sk-row"><div className={sk("sk-dot")} /><div className={sk("sk-line")} style={w("60%")} /></div>
            </div>
          ))}
        </div>
        <div className="tk-foot">
          <div className={sk("sk-barcode")} />
          <div className="sk-stack" style={{ flex: 1, gap: 6 }}><div className={sk("sk-line")} style={w("55%")} /><div className={sk("sk-line")} style={w("38%")} /></div>
        </div>
      </TicketPaper>
    </div>
  );
}

export function TicketGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="ticket-grid" aria-busy="true" aria-label="Loading tickets">
      {Array.from({ length: count }, (_, i) => <TicketCardSkeleton key={i} />)}
    </div>
  );
}

/** Skeleton rows with the tickets table's header and column widths. */
export function TicketTableSkeleton({ rows = 8 }: { rows?: number }) {
  const cells: (string | number)[] = [74, "70%", 96, 78, "60%", 84, 90, "65%", 96];
  return (
    <section className="table-wrap" aria-busy="true" aria-label="Loading tickets">
      <table className="data tickets is-skel">
        <thead>
          <tr><th>Ticket ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Module</th><th>Type</th><th>Environment</th><th>Assignee</th><th>Created at</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>{cells.map((c, i) => <td key={i}><div className={sk(i === 2 || i === 3 ? "sk-pill" : "")} style={w(c)} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** The whole All Tickets / My Tickets page while its route loads. */
export function TicketListSkeleton({ mine }: { mine?: boolean }) {
  return (
    <main className="page" aria-busy="true">
      <PageHeadSkeleton action />
      <div className="toolbar" aria-hidden="true">
        <div className="toolbar-row" style={{ gap: 8 }}>
          <div className={sk()} style={{ width: 260, height: 36 }} />
          {[84, 78, 92, 96, 108, 70, 88].map((x, i) => <div key={i} className={sk()} style={{ width: x, height: 32, borderRadius: 16 }} />)}
        </div>
      </div>
      <TicketGridSkeleton />
      <span className="sr-only">{mine ? "Loading your tickets" : "Loading tickets"}</span>
    </main>
  );
}

/** The large ticket sheet and its tab bar. */
export function TicketSheetSkeleton() {
  return (
    <main className="page ticket-page" aria-busy="true" aria-label="Loading ticket">
      <div className="crumb-row" aria-hidden="true"><div className={sk("sk-line")} style={{ width: 96, height: 14 }} /></div>
      <TicketPaper priority="low" className="sheet" paperClassName="sheet-paper">
        <header className="sheet-head sheet-head-skel" aria-hidden="true">
          <div className="sheet-id">
            <div className={sk("sk-line")} style={w(80)} />
            <div className={sk("sk-title")} style={{ width: 130, height: 32, marginTop: 6 }} />
          </div>
          <div className="sheet-title">
            <div className={sk("sk-title")} style={{ height: 22, width: "78%" }} />
            <div className={sk("sk-title")} style={{ height: 22, width: "46%", marginTop: 8 }} />
            <div className="sheet-badges"><div className={sk("sk-pill")} style={w(90)} /><div className={sk("sk-pill")} style={w(72)} /><div className={sk("sk-pill")} style={w(80)} /></div>
          </div>
        </header>
        <Perf />
        <section className="sheet-section" aria-hidden="true">
          <ol className="stepper" style={{ listStyle: "none" }}>
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="step todo">
                <span className={sk("sk-dot")} style={{ width: 22, height: 22, zIndex: 1 }} />
                <div className={sk("sk-line")} style={{ width: 54 }} />
              </li>
            ))}
          </ol>
          <div className={sk()} style={{ height: 64, marginTop: 18, borderRadius: 12 }} />
        </section>
        <Perf />
        <section className="sheet-section" aria-hidden="true">
          <dl className="sheet-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="sheet-f"><div className={sk("sk-line")} style={{ width: 64, marginBottom: 8 }} /><div className={sk("sk-line")} style={{ width: "62%", height: 14 }} /></div>
            ))}
          </dl>
        </section>
        <Perf />
        <section className="sheet-section" aria-hidden="true">
          <div className="crew-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="crew-block">
                <div className={sk("sk-line")} style={{ width: 76, marginBottom: 10 }} />
                <div className="sk-row"><div className={sk("sk-dot")} style={{ width: 32, height: 32 }} /><div className={sk("sk-line")} style={{ width: "60%", height: 14 }} /></div>
              </div>
            ))}
          </div>
        </section>
        <footer className="sheet-foot" aria-hidden="true">
          <div className={sk()} style={{ width: 150, height: 30, borderRadius: 4 }} />
          <div className="sk-stack" style={{ gap: 6 }}><div className={sk("sk-line")} style={w(70)} /><div className={sk("sk-line")} style={w(160)} /></div>
        </footer>
      </TicketPaper>
      <div className="tabs-skel" aria-hidden="true">{[64, 70, 88, 64, 84, 82, 96, 70, 64].map((x, i) => <div key={i} className={sk()} style={w(x)} />)}</div>
      <div className="panel tab-panel" aria-hidden="true">
        <div className={sk("sk-line")} style={{ width: 96, height: 13, marginBottom: 14 }} />
        <div className="sk-stack" style={{ gap: 9 }}>
          <div className={sk("sk-line")} style={w("96%")} /><div className={sk("sk-line")} style={w("90%")} /><div className={sk("sk-line")} style={w("64%")} />
        </div>
      </div>
    </main>
  );
}

/** Dashboard body: KPI cards, panels and the recent-ticket cards. */
export function DashboardSkeleton() {
  const panel = (cls: string, rows: number, chart?: boolean) => (
    <div className={"panel " + cls}>
      <div className="panel-head"><div className={sk("sk-title")} style={w(120)} /></div>
      <div className="dash-skel-body">
        {chart ? <div className={sk("dash-skel-chart")} /> : Array.from({ length: rows }, (_, i) => <div key={i} className={sk()} style={{ height: 28 }} />)}
      </div>
    </div>
  );
  return (
    <div className="dash-grid" aria-busy="true" aria-label="Loading dashboard">
      <div className="dash-kpis">{Array.from({ length: 6 }, (_, i) => <div key={i} className={sk("dash-kpi-skel")} />)}</div>
      {panel("dash-queue", 4)}
      {panel("dash-trend", 0, true)}
      {panel("dash-pipeline", 2)}
      {[0, 1, 2, 3].map((i) => <Fragment key={i}>{panel("dash-third", 3)}</Fragment>)}
      <section className="dash-recent" aria-hidden="true">
        <div className="dash-recent-head"><div className={sk("sk-title")} style={{ width: 150, height: 20 }} /></div>
        <TicketGridSkeleton count={3} />
      </section>
    </div>
  );
}

/** Comment-shaped placeholders for the Comments tab. */
export function CommentsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <ul className="cm-list" aria-busy="true" aria-label="Loading comments">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="cm" aria-hidden="true">
          <div className={sk("sk-dot")} style={{ width: 32, height: 32 }} />
          <div className="sk-stack" style={{ gap: 9 }}>
            <div className={sk("sk-line")} style={w(140)} />
            <div className={sk("sk-line")} style={w("92%")} />
            <div className={sk("sk-line")} style={w("58%")} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Create-ticket form while its route loads. */
export function CreateTicketSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <PageHeadSkeleton />
      <div className="create-layout">
        <div className="panel create-form">
          <div className="form-section">
            <div className={sk()} style={{ height: 40 }} />
            <div className={sk()} style={{ height: 150 }} />
          </div>
          <div className="form-section"><RowsSkeleton rows={4} panel={false} /></div>
        </div>
        <aside className="create-preview" aria-hidden="true"><TicketCardSkeleton /></aside>
      </div>
    </main>
  );
}
