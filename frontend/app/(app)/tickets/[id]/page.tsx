"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type ModuleView } from "@/lib/api";
import { Avatar, Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Perf, TicketPaper } from "@/components/TicketPaper";
import { Barcode, EnvLabel, Person, PriorityBadge, PriorityBars, StatusBadge, TicketCardView, TypeLabel } from "@/components/TicketBits";
import { toast } from "@/components/Toast";
import { UserPicker } from "@/components/UserPicker";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import {
  CLOSURE_LABEL, ENV_LABEL, PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, WORKFLOW, WORKFLOW_ACTIVITY, fmtDate, isArabic, relTime,
  type ActivityView, type DirectoryEntry, type Environment, type PersonRef, type Priority, type Status, type TicketDetail, type TicketType,
} from "@/lib/tickets";

type Tab = "overview" | "related" | "activity";
type RoleKey = "assignee" | "reviewer" | "tester";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [people, setPeople] = useState<DirectoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState<RoleKey | null>(null);
  const [addingCollab, setAddingCollab] = useState(false);

  const load = useCallback(async () => {
    try {
      setT(await api.get<TicketDetail>(`/api/tickets/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? { code: e.code, message: e.message } : { code: "X", message: "Couldn't load the ticket." });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<DirectoryEntry[]>("/api/users/directory").then(setPeople).catch(() => {}); }, []);

  async function act(p: Promise<TicketDetail>, ok: string) {
    try {
      setT(await p);
      toast(ok);
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "That didn't work.", "error");
      if (e instanceof ApiError && e.code === "STALE") load();
      return false;
    }
  }

  if (error) {
    return (
      <main className="page">
        <div className="empty panel">
          <h3>{error.code === "NOT_FOUND" ? `TKT-${id} doesn't exist` : "This ticket didn't load"}</h3>
          <p>{error.message}</p>
          <Link className="btn" href="/tickets">Back to all tickets</Link>
        </div>
      </main>
    );
  }
  if (!t) return <main className="page"><div className="sheet-skel" /></main>;

  const ar = isArabic(t.title);
  const related = t.links.filter((l) => l.type === "RELATED");

  return (
    <main className="page ticket-page">
      <div className="crumb-row">
        <Link href="/tickets" className="back-link"><Icon name="arrowLeft" size="sm" />All tickets</Link>
      </div>

      <TicketPaper priority={t.priority.toLowerCase() as "low"} className="sheet" paperClassName="sheet-paper">
        {t.status === "CLOSED" && t.closure && <div className={"stamp big " + t.closure.toLowerCase()}>{CLOSURE_LABEL[t.closure]}</div>}

        <header className="sheet-head">
          <div className="sheet-id">
            <span className="sheet-type"><TypeLabel type={t.type} /></span>
            <b className="num"><span>#TKT-</span>{t.id}</b>
          </div>
          <div className="sheet-title">
            <h1 dir="auto" lang={ar ? "ar" : undefined} className={ar ? "ar" : undefined}>{t.title}</h1>
            <div className="sheet-badges">
              <StatusBadge status={t.status} closure={t.closure} />
              <PriorityBadge level={t.priority} />
              <span className={"tag " + (t.environment === "PRODUCTION" ? "env-prod" : "env-test")}>{ENV_LABEL[t.environment]}</span>
            </div>
          </div>
          {t.can.edit && (
            <button className="btn sheet-edit" type="button" onClick={() => setEditing(true)}><Icon name="edit" size="sm" />Edit</button>
          )}
        </header>

        <Perf />
        <section className="sheet-section" aria-label="Workflow stage">
          <Stepper status={t.status} before={t.statusBeforeBlock} closure={t.closure} />
          <WorkflowPanel t={t} people={people} onUpdated={setT} onStale={load} />
        </section>

        <Perf />
        <section className="sheet-section">
          <dl className="sheet-grid">
            <Field k="Type"><TypeLabel type={t.type} /></Field>
            <Field k="Priority"><span className={"prio-inline " + t.priority.toLowerCase()}><PriorityBars level={t.priority} />{PRIORITY_LABEL[t.priority]}</span></Field>
            <Field k="Module"><Icon name="box" size="xs" /><span>{t.module.name}</span></Field>
            <Field k="Environment"><EnvLabel env={t.environment} /></Field>
            <Field k="Created by"><Avatar name={t.creator.fullName} color={t.creator.avatarColor} size="xs" /><span dir="auto">{t.creator.fullName}</span></Field>
            <Field k="Created"><span className="num">{fmtDate(t.createdAt, true)}</span></Field>
            <Field k="Patch reference">{t.patchReference ? <code className="patch">{t.patchReference}</code> : <span className="muted">Not set</span>}</Field>
            {t.status === "CLOSED" && (
              <>
                <Field k="Closure">{t.closure ? CLOSURE_LABEL[t.closure] : "—"}</Field>
                <Field k="Closed by">{t.closedBy ? <><span dir="auto">{t.closedBy.fullName}</span><small className="num">{fmtDate(t.closedAt)}</small></> : "—"}</Field>
              </>
            )}
          </dl>
        </section>

        <Perf />
        <section className="sheet-section">
          <div className="crew-grid">
            <Crew label="Assigned to" p={t.assignee} canChange={t.can.assign} onChange={() => setAssigning("assignee")} lead />
            <div className="crew-block">
              <div className="tk-k">Assigned by</div>
              <Person p={t.assignedBy} size="lg" empty="—" sub={t.assignedAt ? fmtDate(t.assignedAt, true) : undefined} />
            </div>
            <Crew label="Code reviewer" p={t.reviewer} canChange={t.can.assignReviewer} onChange={() => setAssigning("reviewer")} empty="Not assigned" />
            <Crew label="Tester" p={t.tester} canChange={t.can.assignTester} onChange={() => setAssigning("tester")} empty="Not assigned" />
            <div className="crew-block wide">
              <div className="tk-k">Collaborators</div>
              <div className="chip-row">
                {t.collaborators.map((c) => (
                  <span key={c.id} className="picker-chip">
                    <Avatar name={c.fullName} color={c.avatarColor} size="xs" /><span dir="auto">{c.fullName}</span>
                    {t.can.removeCollaborator && (
                      <button type="button" aria-label={`Remove ${c.fullName}`} onClick={() => removeCollaborator(c)}>
                        <Icon name="x" size="xs" />
                      </button>
                    )}
                  </span>
                ))}
                {t.collaborators.length === 0 && <span className="muted">No one yet</span>}
                {t.can.addCollaborator && <button className="btn ghost sm" type="button" onClick={() => setAddingCollab(true)}><Icon name="plus" size="sm" />Add</button>}
              </div>
            </div>
            <div className="crew-block wide">
              <div className="tk-k">Code contributors</div>
              <div className="chip-row">
                {t.contributors.map((c) => (
                  <span key={c.id} className="picker-chip"><Avatar name={c.fullName} color={c.avatarColor} size="xs" /><span dir="auto">{c.fullName}</span></span>
                ))}
                {t.contributors.length === 0 && <span className="muted">Recorded when code is submitted for review</span>}
              </div>
            </div>
          </div>
        </section>

        <footer className="sheet-foot">
          <Barcode seed={t.id} width={150} height={30} className="barcode wide" />
          <div className="sheet-foot-meta">
            <b className="num">TKT-{t.id}</b>
            <span>Issued {fmtDate(t.createdAt)}{t.updatedAt && <> · updated {relTime(t.updatedAt)}</>}</span>
          </div>
          {related.length > 0 && (
            <div className="sheet-rel">
              <Icon name="link" size="xs" />
              {related.map((l) => <Link key={l.ticket.id} href={`/tickets/${l.ticket.id}`} className={"id-chip p-" + l.ticket.priority.toLowerCase()}>TKT-{l.ticket.id}</Link>)}
            </div>
          )}
        </footer>
      </TicketPaper>

      <div className="tabs" role="tablist" aria-label="Ticket sections">
        {([["overview", "Overview", null], ["related", "Related tickets", t.links.length], ["activity", "Activity", t.activity.length]] as [Tab, string, number | null][]).map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>
            {label}{n ? <span className="tab-n">{n}</span> : null}
          </button>
        ))}
        <span className="tabs-later" title="Comments and attachments come in a later phase">Comments and attachments arrive next</span>
      </div>

      {tab === "overview" && (
        <section className="panel tab-panel">
          <h2 className="tab-h">Description</h2>
          <div className={"description" + (isArabic(t.description) ? " ar" : "")} dir="auto">{t.description}</div>
          {t.closureReason && (
            <>
              <h2 className="tab-h" style={{ marginTop: 22 }}>Closure reason</h2>
              <div className="description" dir="auto">{t.closureReason}</div>
            </>
          )}
        </section>
      )}

      {tab === "related" && <RelatedTab t={t} onChange={(p, ok) => act(p, ok)} />}
      {tab === "activity" && <ActivityTab items={t.activity} />}

      {editing && <EditModal t={t} onClose={() => setEditing(false)} onSave={async (body) => { if (await act(api.put<TicketDetail>(`/api/tickets/${t.id}`, { ...body, version: t.version }), "Ticket updated")) setEditing(false); }} />}

      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title={assigning === "assignee" ? "Assign ticket" : assigning === "reviewer" ? "Choose code reviewer" : "Choose tester"}
        description={assigning === "assignee" ? "The assignee owns the fix and moves it through the workflow."
          : "Must be independent: nobody who contributed code to this ticket can " + (assigning === "reviewer" ? "review" : "test") + " it."}
      >
        {assigning && (
          <AssignBody
            t={t}
            role={assigning}
            people={people}
            onCancel={() => setAssigning(null)}
            onSave={async (userId) => {
              const label = assigning === "assignee" ? "Assignee" : assigning === "reviewer" ? "Reviewer" : "Tester";
              if (await act(api.put<TicketDetail>(`/api/tickets/${t.id}/${assigning}`, { userId, version: t.version }), userId ? `${label} updated` : `${label} cleared`)) setAssigning(null);
            }}
          />
        )}
      </Modal>

      <Modal open={addingCollab} onClose={() => setAddingCollab(false)} title="Add collaborators" description="Collaborators follow the ticket and get its updates.">
        {addingCollab && (
          <CollabBody
            existing={t.collaborators.map((c) => c.id)}
            people={people}
            onCancel={() => setAddingCollab(false)}
            onSave={async (ids) => {
              let ok = true;
              for (const uid of ids) ok = (await act(api.post<TicketDetail>(`/api/tickets/${t.id}/collaborators`, { userId: uid }), "Collaborator added")) && ok;
              if (ok) setAddingCollab(false);
            }}
          />
        )}
      </Modal>
    </main>
  );

  async function removeCollaborator(c: PersonRef) {
    if (!t) return;
    await act(api.del<TicketDetail>(`/api/tickets/${t.id}/collaborators/${c.id}`), `${c.fullName} removed`);
  }
}

/* ------------------------------------------------------------------ pieces */

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="sheet-f"><dt>{k}</dt><dd>{children}</dd></div>;
}

function Crew({ label, p, canChange, onChange, empty, lead }: { label: string; p: PersonRef | null; canChange: boolean; onChange: () => void; empty?: string; lead?: boolean }) {
  return (
    <div className={"crew-block" + (lead ? " lead" : "")}>
      <div className="tk-k">{label}</div>
      <div className="crew-row">
        <Person p={p} size="lg" empty={empty} sub={p ? (p.organization === "VENDOR" ? "HQ" : "Port") + (p.active ? "" : " · deactivated") : undefined} />
        {canChange && <button className="btn ghost sm" type="button" onClick={onChange} aria-label={`Change ${label.toLowerCase()}`}>{p ? "Change" : "Assign"}</button>}
      </div>
    </div>
  );
}

/** The workflow line: done stops are filled, the current one rings, Blocked hangs off the current stop. */
function Stepper({ status, before, closure }: { status: Status; before: Status | null; closure: string | null }) {
  const blocked = status === "BLOCKED";
  const at = blocked ? (before ?? "OPEN") : status;
  const idx = WORKFLOW.indexOf(at);
  return (
    <ol className={"stepper" + (blocked ? " is-blocked" : "")}>
      {WORKFLOW.map((s, i) => {
        const state = i < idx || (s === "CLOSED" && status === "CLOSED") ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={s} className={"step " + state + (s === "CLOSED" && closure ? " closure-" + closure.toLowerCase() : "")} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-dot">{state === "done" && <Icon name="check" size="xs" />}</span>
            <span className="step-label">{STATUS_LABEL[s]}</span>
            {blocked && i === idx && <span className="step-blocked"><Icon name="blocked" size="xs" />Blocked</span>}
          </li>
        );
      })}
    </ol>
  );
}

function RelatedTab({ t, onChange }: { t: TicketDetail; onChange: (p: Promise<TicketDetail>, ok: string) => Promise<boolean> }) {
  const [num, setNum] = useState("");
  const LABEL = { RELATED: "Related", FOLLOW_UP_OF: "Follow-up", BLOCKED_BY: "Blocking" } as const;
  return (
    <section className="tab-panel">
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
      {t.links.length === 0 ? (
        <div className="empty panel"><h3>No related tickets</h3><p>Link tickets that describe the same problem or depend on each other.</p></div>
      ) : (
        <div className="ticket-grid">
          {t.links.map((l) => (
            <div key={l.type + l.ticket.id} className="rel-card">
              <div className="rel-head">
                <span className="rel-type">{LABEL[l.type]}{l.type === "FOLLOW_UP_OF" && (l.direction === "OUTGOING" ? " of" : " ticket")}</span>
                {l.type === "RELATED" && t.can.link && (
                  <button className="clear-link" type="button" onClick={() => onChange(api.del<TicketDetail>(`/api/tickets/${t.id}/related/${l.ticket.id}`), `Unlinked TKT-${l.ticket.id}`)}>Unlink</button>
                )}
              </div>
              <TicketCardView t={l.ticket} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const FIELD_LABEL: Record<string, string> = { title: "title", description: "description", type: "type", module: "module", environment: "environment", patchReference: "patch reference", priority: "priority" };

function describe(a: ActivityView): React.ReactNode {
  const v = (x: string | null) => {
    if (x == null) return "none";
    return (STATUS_LABEL as Record<string, string>)[x] ?? (PRIORITY_LABEL as Record<string, string>)[x] ?? (TYPE_LABEL as Record<string, string>)[x] ?? (ENV_LABEL as Record<string, string>)[x] ?? x;
  };
  switch (a.action) {
    case "CREATED": return <>created the ticket</>;
    case "PRIORITY_CHANGED": return <>changed priority from <b>{v(a.oldValue)}</b> to <b>{v(a.newValue)}</b></>;
    case "ASSIGNEE_CHANGED": return a.newValue ? <>assigned it to <b dir="auto">{a.newValue}</b>{a.oldValue && <> (was {a.oldValue})</>}</> : <>removed the assignee <b>{a.oldValue}</b></>;
    case "REVIEWER_CHANGED": return a.newValue ? <>made <b dir="auto">{a.newValue}</b> the code reviewer</> : <>cleared the code reviewer</>;
    case "TESTER_CHANGED": return a.newValue ? <>made <b dir="auto">{a.newValue}</b> the tester</> : <>cleared the tester</>;
    case "COLLABORATOR_ADDED": return <>added <b dir="auto">{a.newValue}</b> as a collaborator</>;
    case "COLLABORATOR_REMOVED": return <>removed collaborator <b dir="auto">{a.oldValue}</b></>;
    case "LINK_ADDED": return <>linked <b>{a.newValue}</b></>;
    case "LINK_REMOVED": return <>unlinked <b>{a.oldValue}</b></>;
    case "STATUS_CHANGED": return <>moved it from <b>{v(a.oldValue)}</b> to <b>{v(a.newValue)}</b></>;
    case "CLOSED": return <>closed the ticket as <b>{v(a.newValue)}</b></>;
    case "FIELD_CHANGED":
      if (a.field === "description") return <>edited the description</>;
      return <>changed the {FIELD_LABEL[a.field ?? ""] ?? a.field}{a.oldValue || a.newValue ? <> from <b><bdi>{v(a.oldValue)}</bdi></b> to <b><bdi>{v(a.newValue)}</bdi></b></> : null}</>;
    case "REVIEW_SUBMITTED": return <>submitted the code for review{a.newValue && <> by <b dir="auto">{a.newValue}</b></>}</>;
    case "CONTRIBUTORS_CHANGED": return <>updated the code contributors{a.newValue && <>: <b dir="auto">{a.newValue}</b></>}</>;
    case "BLOCKED": return <>blocked the ticket{a.newValue && <>, waiting for <b>{a.newValue}</b></>}</>;
    case "FOLLOW_UP_CREATED": return <>opened follow-up <b>{a.newValue}</b></>;
    case "VERIFICATION_FAILED": return <>recorded that production verification failed</>;
    case "DEPLOYED": return <>marked it deployed{a.newValue && <> with patch <b>{a.newValue}</b></>}</>;
    default: return <>{WORKFLOW_ACTIVITY[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}</>;
  }
}

function ActivityTab({ items }: { items: ActivityView[] }) {
  return (
    <section className="panel tab-panel">
      <ol className="timeline">
        {items.map((a) => (
          <li key={a.id} className={"tl-item tl-" + a.action.toLowerCase()}>
            <span className="tl-dot" />
            <div className="tl-body">
              <span className="tl-text"><b dir="auto">{a.actor.fullName}</b> {describe(a)}</span>
              {a.note && <p className="tl-note" dir="auto">{a.note}</p>}
            </div>
            <time className="tl-time num" dateTime={a.at} title={fmtDate(a.at, true)}>{relTime(a.at)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EditModal({ t, onClose, onSave }: { t: TicketDetail; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description);
  const [type, setType] = useState<TicketType>(t.type);
  const [priority, setPriority] = useState<Priority>(t.priority);
  const [env, setEnv] = useState<Environment>(t.environment);
  const [moduleId, setModuleId] = useState(t.module.id);
  const [patch, setPatch] = useState(t.patchReference ?? "");
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<ModuleView[]>("/api/modules").then(setModules).catch(() => {}); }, []);

  const body = useMemo(() => {
    const b: Record<string, unknown> = {};
    if (title.trim() !== t.title) b.title = title;
    if (description.trim() !== t.description) b.description = description;
    if (type !== t.type) b.type = type;
    if (priority !== t.priority) b.priority = priority;
    if (env !== t.environment) b.environment = env;
    if (moduleId !== t.module.id) b.moduleId = moduleId;
    if ((patch.trim() || null) !== t.patchReference) b.patchReference = patch.trim();
    return b;
  }, [title, description, type, priority, env, moduleId, patch, t]);
  const changed = Object.keys(body).length > 0;
  const moduleOptions = modules.some((m) => m.id === t.module.id) ? modules : [{ id: t.module.id, name: t.module.name + " (inactive)", nameAr: null, active: false, sortOrder: 0 }, ...modules];

  return (
    <Modal open onClose={onClose} wide title={`Edit TKT-${t.id}`}
      footer={<>
        <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={!changed || busy || !title.trim() || !description.trim()} onClick={async () => { setBusy(true); await onSave(body); setBusy(false); }}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </>}
    >
      <div className="form-grid">
        <div className="field span-2"><label htmlFor="e-title">Title</label><input id="e-title" className="input" dir="auto" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field span-2"><label htmlFor="e-desc">Description</label><textarea id="e-desc" className="textarea" dir="auto" rows={7} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="field">
          <span className="field-label">Type</span>
          <div className="seg">{(Object.keys(TYPE_LABEL) as TicketType[]).map((v) => <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}>{TYPE_LABEL[v]}</button>)}</div>
        </div>
        <div className="field">
          <span className="field-label">Environment</span>
          <div className="seg">{(Object.keys(ENV_LABEL) as Environment[]).map((v) => <button key={v} type="button" aria-pressed={env === v} onClick={() => setEnv(v)}>{ENV_LABEL[v]}</button>)}</div>
        </div>
        <div className="field span-2">
          <span className="field-label">Priority {!t.can.changePriority && <span className="opt">— you can&apos;t change priority</span>}</span>
          <div className="prio-pick">
            {PRIORITIES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} disabled={!t.can.changePriority} className={"prio-opt " + p.toLowerCase()} onClick={() => setPriority(p)}><PriorityBars level={p} />{PRIORITY_LABEL[p]}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="e-module">Module</label>
          <select id="e-module" className="input" value={moduleId} onChange={(e) => setModuleId(Number(e.target.value))}>
            {moduleOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="e-patch">Patch reference</label><input id="e-patch" className="input" value={patch} maxLength={100} onChange={(e) => setPatch(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function AssignBody({ t, role, people, onSave, onCancel }: { t: TicketDetail; role: RoleKey; people: DirectoryEntry[]; onSave: (id: number | null) => Promise<void>; onCancel: () => void }) {
  const current = role === "assignee" ? t.assignee : role === "reviewer" ? t.reviewer : t.tester;
  const [value, setValue] = useState<number | null>(current?.id ?? null);
  const [busy, setBusy] = useState(false);
  const exclude = new Map<number, string>();
  if (role !== "assignee") {
    t.contributors.forEach((c) => exclude.set(c.id, "Contributed code — not independent"));
    const other = role === "reviewer" ? t.tester : t.reviewer;
    if (other) exclude.set(other.id, `Already the ${role === "reviewer" ? "tester" : "reviewer"}`);
  }
  return (
    <>
      <UserPicker people={people} value={value} onChange={setValue} exclude={exclude} prefer={role === "tester" ? ["TESTER"] : ["DEVELOPER"]} placeholder="Search by name or role" />
      <div className="modal-foot" style={{ padding: "18px 0 0" }}>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="button" disabled={busy || value === (current?.id ?? null)} onClick={async () => { setBusy(true); await onSave(value); setBusy(false); }}>
          {busy ? "Saving…" : value == null ? "Clear" : "Save"}
        </button>
      </div>
    </>
  );
}

function CollabBody({ existing, people, onSave, onCancel }: { existing: number[]; people: DirectoryEntry[]; onSave: (ids: number[]) => Promise<void>; onCancel: () => void }) {
  const [ids, setIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <UserPicker multi people={people.filter((p) => !existing.includes(p.id))} value={ids} onChange={setIds} placeholder="Search people" />
      <div className="modal-foot" style={{ padding: "18px 0 0" }}>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="button" disabled={busy || ids.length === 0} onClick={async () => { setBusy(true); await onSave(ids); setBusy(false); }}>
          {busy ? "Adding…" : ids.length > 1 ? `Add ${ids.length} people` : "Add"}
        </button>
      </div>
    </>
  );
}
