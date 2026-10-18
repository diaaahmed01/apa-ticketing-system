"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AttachmentChip, Lightbox } from "./FileBits";
import { Avatar, Icon } from "./Icon";
import { RowsSkeleton } from "./Skeletons";
import { Person, StatusBadge, TicketCardView } from "./TicketBits";
import { toast } from "./Toast";
import {
  ACTION_LABEL, PRIMARY_ACTIONS, STATUS_COLOR, STATUS_LABEL, duration, fmtDate, ticketNo,
  type AttachmentView, type PersonRef, type TicketCard, type TicketDetail, type WfBlock, type WorkflowAction, type WorkflowData,
} from "@/lib/tickets";

/* The workflow tabs on the ticket page: Workflow, Code Review, Testing, Deployment and Dependencies.
   They read one document, GET /api/tickets/{id}/workflow, fetched when the first of them is opened and
   again whenever the ticket changes (a workflow action, an assignment, new evidence). */

export type WfState = { data: WorkflowData | null; error: string | null; reload: () => void };
type OnAction = (a: WorkflowAction) => void;

/** `key` changes whenever the ticket does (version, evidence, status), which triggers a refetch. */
export function useWorkflowData(id: string | number, key: string, enabled: boolean): WfState {
  const [data, setData] = useState<WorkflowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  const load = useCallback(async () => {
    const n = ++req.current;
    try {
      const d = await api.get<WorkflowData>(`/api/tickets/${id}/workflow`);
      if (n !== req.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (n === req.current) setError(e instanceof ApiError ? e.message : "Couldn't load the workflow.");
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (enabled) load(); }, [enabled, key, load]);
  return { data, error, reload: load };
}

/* ------------------------------------------------------------------ shared bits */

/** Loading skeleton, error with retry, or the content. */
function Gate({ wf, children }: { wf: WfState; children: (d: WorkflowData) => React.ReactNode }) {
  if (!wf.data && wf.error) {
    return (
      <section className="empty panel tab-panel">
        <Icon name="alert" />
        <h3>This didn&apos;t load</h3>
        <p>{wf.error}</p>
        <button className="btn" type="button" onClick={wf.reload}>Try again</button>
      </section>
    );
  }
  if (!wf.data) {
    return (
      <section className="tab-panel"><RowsSkeleton rows={3} /></section>
    );
  }
  return <section className="tab-panel wf-tab">{children(wf.data)}</section>;
}

type Tone = "ok" | "bad" | "wait" | "info" | "mute";
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={"wf-pill tone-" + tone}>{children}</span>;
}

function Who({ p }: { p: PersonRef | null }) {
  if (!p) return <span className="muted">someone</span>;
  return <span className="who"><Avatar name={p.fullName} color={p.avatarColor} size="xs" /><b dir="auto">{p.fullName}</b></span>;
}

function Stamp({ at, by, verb }: { at: string | null; by: PersonRef | null; verb: string }) {
  if (!at) return null;
  return <span className="stamp-line">{verb} <Who p={by} /> <span className="num">· {fmtDate(at, true)}</span></span>;
}

function Quote({ children }: { children: string | null }) {
  if (!children) return null;
  return <p className="wf-quote" dir="auto">{children}</p>;
}

function Actions({ t, wanted, onAction, labels }: { t: TicketDetail; wanted: WorkflowAction[]; onAction: OnAction; labels?: Partial<Record<WorkflowAction, string>> }) {
  const avail = wanted.filter((a) => t.actions.includes(a));
  if (avail.length === 0) return null;
  return (
    <div className="wf-tab-actions">
      {avail.map((a, i) => (
        <button key={a} type="button" className={"btn" + (i === 0 ? " primary" : "")} onClick={() => onAction(a)}>{labels?.[a] ?? ACTION_LABEL[a]}</button>
      ))}
    </div>
  );
}

function Empty({ icon, title, children }: { icon: "pr" | "flask" | "rocket" | "link" | "history" | "unlock"; title: string; children: string }) {
  return (
    <div className="wf-empty">
      <Icon name={icon} />
      <b>{title}</b>
      <p>{children}</p>
    </div>
  );
}

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* ------------------------------------------------------------------ Workflow */

export function WorkflowTab({ t, wf, onAction }: { t: TicketDetail; wf: WfState; onAction: OnAction }) {
  return (
    <Gate wf={wf}>
      {(d) => {
        const now = d.current;
        const next = PRIMARY_ACTIONS.find((a) => t.actions.includes(a));
        return (
          <>
            <div className={"panel wf-now" + (now.status === "BLOCKED" ? " is-blocked" : "")}>
              <div className="wf-now-head">
                <span className="tk-k">Now</span>
                <StatusBadge status={now.status} closure={t.closure} />
              </div>
              <p className="wf-now-text">
                {now.waitingOn && now.waitingFor.startsWith("Waiting on") ? (
                  <><Who p={now.waitingOn} /> <span>· {now.waitingFor}</span></>
                ) : now.waitingOn ? (
                  <><span>Waiting on</span> <Who p={now.waitingOn} /> <span>to {lc(now.waitingFor)}</span></>
                ) : (
                  <span>{now.waitingFor}</span>
                )}
              </p>
              {next && <div className="wf-now-act"><button className="btn primary" type="button" onClick={() => onAction(next)}>{ACTION_LABEL[next]}</button></div>}
            </div>

            <h2 className="tab-h" style={{ marginTop: 22 }}>Journey</h2>
            <div className="panel tab-panel">
              <ol className="timeline wf-stages">
                {d.stages.map((s, i) => {
                  const last = i === d.stages.length - 1;
                  return (
                    <li key={i} className={"tl-item wf-stage" + (s.status === "BLOCKED" ? " is-blocked" : "") + (last ? " is-current" : "")}>
                      <span className="tl-dot" style={{ borderColor: STATUS_COLOR[s.status], background: last ? STATUS_COLOR[s.status] : "#fff" }} />
                      <div className="tl-body">
                        <span className="tl-text">
                          <b style={{ color: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</b>
                          {s.enteredBy && <> · {i === 0 ? "opened" : "moved"} by <b dir="auto">{s.enteredBy.fullName}</b></>}
                        </span>
                        <div className="wf-stage-time num">
                          {fmtDate(s.enteredAt, true)}{s.leftAt ? <> → {fmtDate(s.leftAt, true)}</> : null}
                        </div>
                        <Quote>{s.note}</Quote>
                      </div>
                      <span className="tl-time num" title={s.leftAt ? "Time in this stage" : "Time in this stage so far"}>
                        {s.status === "CLOSED" && !s.leftAt ? "" : duration(s.enteredAt, s.leftAt) + (s.leftAt ? "" : " so far")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        );
      }}
    </Gate>
  );
}

/* ------------------------------------------------------------------ Code review */

const REVIEW_PILL: Record<string, [Tone, string]> = {
  NOT_SUBMITTED: ["mute", "Not submitted"],
  AWAITING: ["wait", "Awaiting review"],
  APPROVED: ["ok", "Approved"],
  REJECTED: ["bad", "Rejected"],
  SKIPPED: ["mute", "Review skipped"],
};

export function CodeReviewTab({ t, wf, onAction }: { t: TicketDetail; wf: WfState; onAction: OnAction }) {
  return (
    <Gate wf={wf}>
      {({ review }) => {
        const [tone, label] = REVIEW_PILL[review.status] ?? ["mute", review.status];
        const rounds = review.rounds.map((r, i) => ({ r, n: i + 1 })).reverse();
        return (
          <>
            <div className="panel wf-card">
              <div className="wf-card-grid">
                <div>
                  <div className="tk-k">Code reviewer</div>
                  <Person p={review.reviewer} size="lg" empty="Not assigned" sub={review.reviewer ? orgTag(review.reviewer) : undefined} />
                </div>
                <div>
                  <div className="tk-k">Status</div>
                  <Pill tone={tone}>{label}</Pill>
                </div>
                <div className="wide">
                  <div className="tk-k">Code contributors</div>
                  <div className="chip-row">
                    {review.contributors.map((c) => (
                      <span key={c.id} className="picker-chip"><Avatar name={c.fullName} color={c.avatarColor} size="xs" /><span dir="auto">{c.fullName}</span></span>
                    ))}
                    {review.contributors.length === 0 && <span className="muted">Recorded when code is submitted for review</span>}
                  </div>
                </div>
              </div>
              <Actions t={t} wanted={["review", "submit-review", "skip-review", "contributors"]} onAction={onAction}
                labels={{ review: "Approve or reject" }} />
            </div>

            <h2 className="tab-h" style={{ marginTop: 22 }}>Review history</h2>
            {rounds.length === 0 ? (
              <div className="panel"><Empty icon="pr" title="Not reviewed yet">The code hasn&apos;t been submitted for review. Each round will be listed here with the reviewer&apos;s decision.</Empty></div>
            ) : (
              <ol className="wf-rounds">
                {rounds.map(({ r, n }) => {
                  const [tn, tl] = r.decision ? REVIEW_PILL[r.decision] ?? ["mute", r.decision] : (["wait", "Awaiting decision"] as [Tone, string]);
                  return (
                    <li key={n} className="panel wf-round">
                      <div className="wf-round-head">
                        <b>Round {n}</b>
                        <Pill tone={tn}>{tl}</Pill>
                      </div>
                      <div className="wf-round-lines">
                        {r.decision === "SKIPPED" ? (
                          <Stamp at={r.submittedAt} by={r.submittedBy} verb="Skipped by" />
                        ) : (
                          <Stamp at={r.submittedAt} by={r.submittedBy} verb="Submitted by" />
                        )}
                        {r.contributors && r.contributors.length > 0 && <span className="stamp-line">Contributors: <b dir="auto">{r.contributors.join(", ")}</b></span>}
                      </div>
                      <Quote>{r.reason}</Quote>
                      {r.decision && r.decision !== "SKIPPED" && <div className="wf-round-lines"><Stamp at={r.decidedAt} by={r.decidedBy} verb={r.decision === "APPROVED" ? "Approved by" : "Rejected by"} /></div>}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        );
      }}
    </Gate>
  );
}

const orgTag = (p: PersonRef) => (p.organization === "VENDOR" ? "HQ" : "Port") + (p.active ? "" : " · deactivated");

/* ------------------------------------------------------------------ Testing */

const TEST_PILL: Record<string, [Tone, string]> = {
  NOT_STARTED: ["mute", "Not started"],
  AWAITING: ["wait", "Awaiting result"],
  PASSED: ["ok", "Passed"],
  FAILED: ["bad", "Failed"],
};

export function TestingTab({ t, wf, onAction }: { t: TicketDetail; wf: WfState; onAction: OnAction }) {
  const [preview, setPreview] = useState<AttachmentView | null>(null);
  return (
    <Gate wf={wf}>
      {({ testing }) => {
        const [tone, label] = TEST_PILL[testing.status] ?? ["mute", testing.status];
        const rounds = testing.rounds.map((r, i) => ({ r, n: i + 1 })).reverse();
        return (
          <>
            <div className="panel wf-card">
              <div className="wf-card-grid">
                <div>
                  <div className="tk-k">Tester</div>
                  <Person p={testing.tester} size="lg" empty="Not assigned" sub={testing.tester ? orgTag(testing.tester) : undefined} />
                </div>
                <div>
                  <div className="tk-k">Status</div>
                  <Pill tone={tone}>{label}</Pill>
                </div>
              </div>
              <Actions t={t} wanted={["test-result"]} onAction={onAction} labels={{ "test-result": "Record Pass or Fail" }} />
            </div>

            <h2 className="tab-h" style={{ marginTop: 22 }}>Test history</h2>
            {rounds.length === 0 ? (
              <div className="panel"><Empty icon="flask" title="Not tested yet">Once the fix reaches Testing, each round and its result will be listed here with any evidence.</Empty></div>
            ) : (
              <ol className="wf-rounds">
                {rounds.map(({ r, n }) => (
                  <li key={n} className="panel wf-round">
                    <div className="wf-round-head">
                      <b>Round {n}</b>
                      {r.result ? <Pill tone={r.result === "PASSED" ? "ok" : "bad"}>{r.result === "PASSED" ? "Passed" : "Failed"}</Pill> : <Pill tone="wait">No result yet</Pill>}
                    </div>
                    <div className="wf-round-lines">
                      <span className="stamp-line">Testing started <span className="num">· {fmtDate(r.startedAt, true)}</span></span>
                      {r.testedAt && <Stamp at={r.testedAt} by={r.testedBy} verb="Result by" />}
                    </div>
                    <Quote>{r.notes}</Quote>
                    {r.evidence.length > 0 && (
                      <div className="wf-evidence">
                        <div className="tk-k">Evidence</div>
                        <div className="chip-row">
                          {r.evidence.map((a) => <AttachmentChip key={a.id} a={a} onPreview={setPreview} />)}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <Lightbox file={preview} onClose={() => setPreview(null)} />
          </>
        );
      }}
    </Gate>
  );
}

/* ------------------------------------------------------------------ Deployment */

function copy(text: string) {
  try {
    navigator.clipboard.writeText(text).then(() => toast("Patch reference copied"), () => toast("Couldn't copy it", "error"));
  } catch {
    toast("Couldn't copy it", "error");
  }
}

export function DeploymentTab({ t, wf, onAction }: { t: TicketDetail; wf: WfState; onAction: OnAction }) {
  return (
    <Gate wf={wf}>
      {({ deployment: d }) => {
        const v = d.verification;
        const steps: { key: string; label: string; icon: "checkCircle" | "rocket" | "eye"; at: string | null; by: PersonRef | null; state: "done" | "current" | "todo" | "failed" }[] = [
          { key: "ready", label: "Ready", icon: "checkCircle", at: d.readyAt, by: d.readyBy, state: d.readyAt ? "done" : "current" },
          { key: "deployed", label: "Deployed", icon: "rocket", at: d.deployedAt, by: d.deployedBy, state: d.deployedAt ? "done" : d.readyAt ? "current" : "todo" },
          { key: "verified", label: v?.result === "FAILED" ? "Verification failed" : "Verified", icon: "eye", at: v?.at ?? null, by: v?.by ?? null,
            state: v ? (v.result === "PASSED" ? "done" : "failed") : d.deployedAt ? "current" : "todo" },
        ];
        return (
          <>
            <ol className="panel dep-steps" aria-label="Deployment progress">
              {steps.map((s) => (
                <li key={s.key} className={"dep-step " + s.state} aria-current={s.state === "current" ? "step" : undefined}>
                  <span className="dep-dot"><Icon name={s.state === "failed" ? "x" : s.state === "done" ? "check" : s.icon} size="sm" /></span>
                  <b>{s.label}</b>
                  {s.at ? (
                    <small><span className="num">{fmtDate(s.at, true)}</span>{s.by && <> · <span dir="auto">{s.by.fullName}</span></>}</small>
                  ) : (
                    <small className="muted">{s.state === "current" ? "Waiting" : "Not yet"}</small>
                  )}
                </li>
              ))}
            </ol>

            <div className="panel wf-card" style={{ marginTop: 16 }}>
              <div className="wf-card-grid">
                <div className="wide">
                  <div className="tk-k">Patch reference</div>
                  {d.patchReference ? (
                    <div className="patch-row">
                      <code className="patch">{d.patchReference}</code>
                      <button className="btn ghost sm" type="button" onClick={() => copy(d.patchReference as string)} aria-label="Copy patch reference"><Icon name="copy" size="sm" />Copy</button>
                    </div>
                  ) : <span className="muted">Not set yet. It&apos;s recorded when the fix is marked deployed.</span>}
                </div>
              </div>
              <Actions t={t} wanted={["mark-ready", "mark-deployed", "verify"]} onAction={onAction} />
            </div>

            {v ? (
              <div className={"panel wf-card wf-verify " + (v.result === "PASSED" ? "pass" : "fail")} style={{ marginTop: 16 }}>
                <div className="wf-round-head">
                  <b>Production verification</b>
                  <Pill tone={v.result === "PASSED" ? "ok" : "bad"}>{v.result === "PASSED" ? "Passed" : "Failed"}</Pill>
                </div>
                <div className="wf-round-lines"><Stamp at={v.at} by={v.by} verb="Checked by" /></div>
                <Quote>{v.reason}</Quote>
                {v.followUp && (
                  <div className="rel-card" style={{ marginTop: 14 }}>
                    <div className="rel-head"><span className="rel-type">Follow-up ticket</span></div>
                    <TicketCardView t={v.followUp} />
                  </div>
                )}
              </div>
            ) : !d.deployedAt && (
              <div className="panel" style={{ marginTop: 16 }}>
                <Empty icon="rocket" title="Not deployed yet">Deployment and production verification appear here once the fix is ready for deployment.</Empty>
              </div>
            )}
          </>
        );
      }}
    </Gate>
  );
}

/* ------------------------------------------------------------------ Dependencies */

function LinkCard({ label, card, extra }: { label: string; card: TicketCard; extra?: React.ReactNode }) {
  return (
    <div className="rel-card">
      <div className="rel-head"><span className="rel-type">{label}</span>{extra}</div>
      <TicketCardView t={card} />
    </div>
  );
}

function BlockLine({ b }: { b: WfBlock }) {
  return (
    <>
      <div className="wf-banner-meta">
        {b.blockedByTicket && <span>Waiting for <Link href={`/tickets/${b.blockedByTicket.id}`} className={"id-chip p-" + b.blockedByTicket.priority.toLowerCase()}>{ticketNo(b.blockedByTicket.id)}</Link></span>}
        {b.blockPatch && <span>Waiting for patch <code className="patch">{b.blockPatch}</code></span>}
      </div>
      <div className="wf-round-lines"><Stamp at={b.blockedAt} by={b.blockedBy} verb="Blocked by" /></div>
    </>
  );
}

export function DependenciesTab({ t, wf, onAction, onChange }: {
  t: TicketDetail; wf: WfState; onAction: OnAction;
  onChange: (p: Promise<TicketDetail>, ok: string) => Promise<boolean>;
}) {
  const [num, setNum] = useState("");
  const blocking = t.links.filter((l) => l.type === "BLOCKED_BY" && l.direction === "INCOMING");
  const followUps = t.links.filter((l) => l.type === "FOLLOW_UP_OF");
  const related = t.links.filter((l) => l.type === "RELATED");
  const current = wf.data?.blocks.find((b) => b.current) ?? null;
  const past = (wf.data?.blocks ?? []).filter((b) => !b.current).reverse();

  return (
    <section className="tab-panel wf-tab">
      <h2 className="tab-h">Blocked by</h2>
      {!wf.data && wf.error ? (
        <div className="panel wf-card">
          <p className="wf-quote">{wf.error}</p>
          <div className="wf-tab-actions"><button className="btn" type="button" onClick={wf.reload}>Try again</button></div>
        </div>
      ) : !wf.data ? (
        <RowsSkeleton rows={1} />
      ) : current ? (
        <div className="wf-banner blocked">
          <span className="wf-banner-icon"><Icon name="blocked" /></span>
          <div className="wf-banner-body">
            <b>Blocked</b>
            <Quote>{current.reason}</Quote>
            <BlockLine b={current} />
            {current.blockedByTicket && <div style={{ marginTop: 14, maxWidth: 380 }}><TicketCardView t={current.blockedByTicket} /></div>}
          </div>
          {t.actions.includes("unblock") && <button className="btn" type="button" onClick={() => onAction("unblock")}><Icon name="unlock" size="sm" />Unblock</button>}
        </div>
      ) : (
        <div className="panel"><Empty icon="unlock" title="Not blocked">This ticket isn&apos;t waiting on another ticket or patch.</Empty></div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="tab-h" style={{ marginTop: 22 }}>Block history</h2>
          <ol className="wf-rounds">
            {past.map((b, i) => (
              <li key={i} className="panel wf-round">
                <div className="wf-round-head">
                  <b>Blocked{b.blockedAt && b.unblockedAt ? ` for ${duration(b.blockedAt, b.unblockedAt)}` : ""}</b>
                  <Pill tone="mute">Cleared</Pill>
                </div>
                <Quote>{b.reason}</Quote>
                <BlockLine b={b} />
                <div className="wf-round-lines"><Stamp at={b.unblockedAt} by={b.unblockedBy} verb="Unblocked by" /></div>
                <Quote>{b.note}</Quote>
              </li>
            ))}
          </ol>
        </>
      )}

      <h2 className="tab-h" style={{ marginTop: 22 }}>Blocking</h2>
      {blocking.length === 0 ? (
        <div className="panel"><Empty icon="link" title="Nothing is waiting on this ticket">Tickets that are blocked by this one will be listed here.</Empty></div>
      ) : (
        <div className="ticket-grid">{blocking.map((l) => <LinkCard key={l.ticket.id} label="Waiting for this ticket" card={l.ticket} />)}</div>
      )}

      <h2 className="tab-h" style={{ marginTop: 22 }}>Follow-ups</h2>
      {followUps.length === 0 ? (
        <div className="panel"><Empty icon="history" title="No follow-ups">A follow-up ticket is opened when production verification fails.</Empty></div>
      ) : (
        <div className="ticket-grid">
          {followUps.map((l) => <LinkCard key={l.ticket.id} label={l.direction === "OUTGOING" ? "Follow-up of" : "Follow-up ticket"} card={l.ticket} />)}
        </div>
      )}

      <h2 className="tab-h" style={{ marginTop: 22 }}>Related tickets</h2>
      {t.can.link && (
        <form className="link-form panel" onSubmit={async (e) => {
          e.preventDefault();
          const n = Number(num.replace(/\D/g, ""));
          if (!n) return;
          if (await onChange(api.post<TicketDetail>(`/api/tickets/${t.id}/related`, { ticketId: n }), `Linked TKT-${n}`)) setNum("");
        }}>
          <Icon name="link" size="sm" />
          <input className="input" placeholder="Ticket number, e.g. 1004" value={num} onChange={(e) => setNum(e.target.value)} aria-label="Ticket number to link" inputMode="numeric" />
          <button className="btn" type="submit" disabled={!num.replace(/\D/g, "")}>Link ticket</button>
        </form>
      )}
      {related.length === 0 ? (
        <div className="empty panel"><h3>No related tickets</h3><p>Link tickets that describe the same problem or depend on each other.</p></div>
      ) : (
        <div className="ticket-grid">
          {related.map((l) => (
            <LinkCard key={l.ticket.id} label="Related" card={l.ticket} extra={t.can.link ? (
              <button className="clear-link" type="button" onClick={() => onChange(api.del<TicketDetail>(`/api/tickets/${t.id}/related/${l.ticket.id}`), `Unlinked TKT-${l.ticket.id}`)}>Unlink</button>
            ) : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}
