"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type ModuleView } from "@/lib/api";
import { useSession } from "@/lib/session";
import { AttachButton, StagedList, useStagedFiles } from "./FileBits";
import { Avatar, Icon } from "./Icon";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { PriorityBars } from "./TicketBits";
import { toast } from "./Toast";
import { UserPicker } from "./UserPicker";
import {
  ACTION_LABEL, CLOSURE_LABEL, ENV_LABEL, FILE_HINT, PRIMARY_ACTIONS, PRIORITIES, PRIORITY_LABEL, TYPE_LABEL, fmtDate, isArabic, parseTicketNo, ticketNo,
  type DirectoryEntry, type Environment, type Priority, type TicketDetail, type TicketType, type WorkflowAction,
} from "@/lib/tickets";

type VerifyResponse = { ticket: TicketDetail; followUpId: number | null };
type Run = (action: WorkflowAction, body: Record<string, unknown>, ok: string) => Promise<void>;

const MAX_REASON = 2000;

/**
 * Workflow actions, the Blocked / Closed banners and the "testing passed" badge.
 * The server decides which actions are offered (`t.actions`) and enforces all of them.
 */
export function WorkflowPanel({ t, people, onUpdated, onStale, openRequest }: {
  t: TicketDetail;
  people: DirectoryEntry[];
  onUpdated: (t: TicketDetail) => void;
  onStale: () => void;
  /** Another part of the page (the workflow tabs) asks for an action modal; a new `seq` opens it. */
  openRequest?: { action: WorkflowAction; seq: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<WorkflowAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = t.status === "BLOCKED";
  // Unblock lives on the blocked banner, so the bar never repeats it.
  const available = t.actions.filter((a) => !(blocked && a === "unblock"));
  const primary = PRIMARY_ACTIONS.find((a) => available.includes(a));
  const more = available.filter((a) => a !== primary);

  function show(a: WorkflowAction) { setError(null); setOpen(a); }
  const lastSeq = useRef(0);
  useEffect(() => {
    if (!openRequest || openRequest.seq === lastSeq.current) return;
    lastSeq.current = openRequest.seq;
    if (t.actions.includes(openRequest.action)) { setError(null); setOpen(openRequest.action); }
  }, [openRequest, t.actions]);
  function close() { if (!busy) { setOpen(null); setError(null); } }

  const run: Run = async (action, body, ok) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<TicketDetail | VerifyResponse>(`/api/tickets/${t.id}/${action}`, { ...body, version: t.version });
      if ("ticket" in r) {
        onUpdated(r.ticket);
        if (r.followUpId) {
          toast(`Opened ${ticketNo(r.followUpId)} as a follow-up`);
          router.push(`/tickets/${r.followUpId}`);
        } else toast(ok);
      } else {
        onUpdated(r);
        toast(ok);
      }
      setOpen(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "STALE") {
        toast(e.message, "error");
        setOpen(null);
        onStale();
      } else {
        setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const shell = { busy, error, onClose: close };

  return (
    <div className="wf">
      {blocked && <BlockedBanner t={t} onUnblock={t.actions.includes("unblock") ? () => show("unblock") : undefined} />}
      {t.status === "CLOSED" && <ClosedBanner t={t} />}

      {(primary || more.length > 0 || (t.status === "TESTING" && t.testResult === "PASSED")) && (
        <div className="wf-bar">
          {t.status === "TESTING" && t.testResult === "PASSED" && (
            <span className="wf-pass"><Icon name="checkCircle" size="xs" />Testing passed</span>
          )}
          <div className="wf-actions">
            {primary && <button className="btn primary" type="button" onClick={() => show(primary)}>{ACTION_LABEL[primary]}</button>}
            {more.length > 0 && <MoreMenu actions={more} onPick={show} />}
          </div>
        </div>
      )}

      {open === "start" && (
        <Shell {...shell} title="Start work" submit="Start work" onSubmit={() => run("start", {}, "Work started")}
          description={`Move ${ticketNo(t.id)} to In Progress. You're taking it on now.`} />
      )}
      {open === "mark-ready" && (
        <Shell {...shell} title="Mark ready for deployment" submit="Mark ready" onSubmit={() => run("mark-ready", {}, "Ready for deployment")}
          description="Testing passed. This hands the fix over for deployment." />
      )}
      {open === "submit-review" && <SubmitReviewForm t={t} people={people} run={run} {...shell} />}
      {open === "contributors" && <ContributorsForm t={t} people={people} run={run} {...shell} />}
      {open === "skip-review" && <ReasonForm {...shell} title="Skip code review"
        description="Use this when the solution needs no code change. The ticket goes straight to Testing."
        label="Why is no review needed?" placeholder="e.g. Data fix only, no code changed" submit="Skip review"
        onSubmit={(reason) => run("skip-review", { reason }, "Sent to testing without review")} />}
      {open === "review" && <DecisionForm {...shell} title="Review the code" yes="Approve" no="Reject"
        yesHint="Moves to Testing" noHint="Back to In Progress" reasonLabel="What needs to change?"
        onSubmit={(pos, reason) => run("review", { decision: pos ? "APPROVE" : "REJECT", reason }, pos ? "Review approved" : "Review rejected")} />}
      {open === "test-result" && <DecisionForm {...shell} title="Record test result" yes="Pass" no="Fail"
        yesHint="Stays in Testing" noHint="Back to In Progress" reasonLabel="What failed?" evidence={t.canUploadEvidence}
        onSubmit={async (pos, reason, files) => {
          if (files.length > 0) {
            // Evidence goes up first, so a failed upload doesn't leave a result with nothing behind it.
            setBusy(true);
            setError(null);
            try {
              const fd = new FormData();
              fd.append("purpose", "EVIDENCE");
              files.forEach((f) => fd.append("files", f));
              await api.upload(`/api/tickets/${t.id}/attachments`, fd);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "The evidence couldn't be uploaded. Try again.");
              setBusy(false);
              return;
            }
            setBusy(false);
          }
          await run("test-result", { result: pos ? "PASS" : "FAIL", reason }, pos ? "Testing passed" : "Testing failed");
        }} />}
      {open === "mark-deployed" && <DeployForm t={t} run={run} {...shell} />}
      {open === "verify" && <VerifyForm t={t} people={people} run={run} {...shell} />}
      {open === "block" && <BlockForm run={run} {...shell} />}
      {open === "unblock" && <ReasonForm {...shell} title="Unblock ticket"
        description={`${ticketNo(t.id)} goes back to ${t.statusBeforeBlock ? statusWord(t.statusBeforeBlock) : "where it was"}. Make sure what it was waiting for is done.`}
        label="Note" optional placeholder="Optional: what changed?" submit="Unblock"
        onSubmit={(note) => run("unblock", { note }, "Ticket unblocked")} />}
      {open === "cancel" && <ReasonForm {...shell} danger title="Cancel ticket"
        description="The ticket closes as Cancelled and can't be changed afterwards."
        label="Why is it being cancelled?" placeholder="e.g. Raised by mistake" submit="Cancel ticket"
        onSubmit={(reason) => run("cancel", { reason }, "Ticket cancelled")} />}
      {open === "close" && <ReasonForm {...shell} danger title="Close as unresolved"
        description="The ticket closes as Unresolved and can't be changed afterwards."
        label="Why is it being closed?" placeholder="e.g. Can't be reproduced, no longer needed" submit="Close ticket"
        onSubmit={(reason) => run("close", { reason }, "Ticket closed as unresolved")} />}
    </div>
  );
}

function statusWord(s: string) {
  return s.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/* ------------------------------------------------------------------ banners */

function BlockedBanner({ t, onUnblock }: { t: TicketDetail; onUnblock?: () => void }) {
  const waiting = t.links.filter((l) => l.type === "BLOCKED_BY" && l.direction === "OUTGOING");
  return (
    <div className="wf-banner blocked" role="status">
      <span className="wf-banner-icon"><Icon name="blocked" /></span>
      <div className="wf-banner-body">
        <b>Blocked</b>
        {t.blockReason && <p dir="auto">{t.blockReason}</p>}
        <div className="wf-banner-meta">
          {waiting.map((l) => (
            <span key={l.ticket.id}>Waiting for <Link href={`/tickets/${l.ticket.id}`} className={"id-chip p-" + l.ticket.priority.toLowerCase()}>{ticketNo(l.ticket.id)}</Link></span>
          ))}
          {t.blockPatch && <span>Waiting for patch <code className="patch">{t.blockPatch}</code></span>}
          {t.blockedBy && <span>Blocked by <b dir="auto">{t.blockedBy.fullName}</b>{t.blockedAt && <> · {fmtDate(t.blockedAt, true)}</>}</span>}
        </div>
      </div>
      {onUnblock && <button className="btn" type="button" onClick={onUnblock}><Icon name="unlock" size="sm" />Unblock</button>}
    </div>
  );
}

function ClosedBanner({ t }: { t: TicketDetail }) {
  if (!t.closure) return null;
  const continued = t.links.find((l) => l.type === "FOLLOW_UP_OF" && l.direction === "INCOMING");
  return (
    <div className={"wf-banner closed " + t.closure.toLowerCase()} role="status">
      <span className="wf-banner-icon"><Icon name={t.closure === "RESOLVED" ? "checkCircle" : t.closure === "CANCELLED" ? "x" : "alert"} /></span>
      <div className="wf-banner-body">
        <b>{CLOSURE_LABEL[t.closure]}</b>
        {t.closureReason && <p dir="auto">{t.closureReason}</p>}
        <div className="wf-banner-meta">
          {t.closedBy && <span>Closed by <b dir="auto">{t.closedBy.fullName}</b>{t.closedAt && <> · {fmtDate(t.closedAt, true)}</>}</span>}
          {continued && <span>Continued in <Link href={`/tickets/${continued.ticket.id}`} className={"id-chip p-" + continued.ticket.priority.toLowerCase()}>{ticketNo(continued.ticket.id)}</Link></span>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ more menu */

function MoreMenu({ actions, onPick }: { actions: WorkflowAction[]; onPick: (a: WorkflowAction) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); btn.current?.focus(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div className="more-wrap" ref={wrap} onKeyDown={onKey}>
      <button ref={btn} className="btn" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        More<Icon name="chevDown" size="xs" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {actions.map((a) => (
            <button key={a} type="button" role="menuitem" className={"menu-item" + (a === "cancel" || a === "close" ? " danger" : "")}
              onClick={() => { setOpen(false); onPick(a); }}>
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ modal pieces */

type ShellProps = { busy: boolean; error: string | null; onClose: () => void };

/** Modal frame: Cancel + a submit button, and the server's error shown inline. */
function Shell({ title, description, submit, danger, canSubmit = true, onSubmit, busy, error, onClose, children, wide }: ShellProps & {
  title: string;
  description?: React.ReactNode;
  submit: string;
  danger?: boolean;
  canSubmit?: boolean;
  onSubmit: () => void;
  children?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Modal open onClose={onClose} title={title} description={description} wide={wide}
      footer={<>
        <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={"btn " + (danger ? "danger" : "primary") + (busy ? " is-busy" : "")} type="button" disabled={busy || !canSubmit} onClick={onSubmit}>
          {busy && <Spinner />}{busy ? "Working…" : submit}
        </button>
      </>}
    >
      {(children || error) && (
        <div className="wf-form">
          {children}
          {error && <p className="err" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function ReasonField({ id, label, value, onChange, required, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{!required && <span className="opt">(optional)</span>}</label>
      <textarea id={id} className="textarea" dir="auto" rows={4} maxLength={MAX_REASON} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} aria-required={required} />
      <span className="reason-count num" aria-live="off">{value.length} / {MAX_REASON}</span>
    </div>
  );
}

function ReasonForm({ title, description, label, placeholder, submit, optional, danger, onSubmit, ...shell }: ShellProps & {
  title: string; description: string; label: string; placeholder?: string; submit: string; optional?: boolean; danger?: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Shell {...shell} title={title} description={description} submit={submit} danger={danger}
      canSubmit={optional || reason.trim().length > 0} onSubmit={() => onSubmit(reason.trim())}>
      <ReasonField id="wf-reason" label={label} value={reason} onChange={setReason} required={!optional} placeholder={placeholder} />
    </Shell>
  );
}

/** Two big choices (Approve/Reject, Pass/Fail); the reason is required on the negative one. */
function Choice({ yes, no, yesHint, noHint, value, onChange }: {
  yes: string; no: string; yesHint: string; noHint: string; value: boolean | null; onChange: (v: boolean) => void;
}) {
  return (
    <div className="choice-pair" role="group">
      <button type="button" className="choice pos" aria-pressed={value === true} onClick={() => onChange(true)}>
        <Icon name="checkCircle" /><b>{yes}</b><small>{yesHint}</small>
      </button>
      <button type="button" className="choice neg" aria-pressed={value === false} onClick={() => onChange(false)}>
        <Icon name="x" /><b>{no}</b><small>{noHint}</small>
      </button>
    </div>
  );
}

function DecisionForm({ title, yes, no, yesHint, noHint, reasonLabel, evidence, onSubmit, ...shell }: ShellProps & {
  title: string; yes: string; no: string; yesHint: string; noHint: string; reasonLabel: string;
  /** Offer an optional evidence file picker (test results). */
  evidence?: boolean;
  onSubmit: (positive: boolean, reason: string, files: File[]) => void;
}) {
  const [pos, setPos] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const staged = useStagedFiles();
  return (
    <Shell {...shell} title={title} submit={pos === false ? no : yes}
      danger={pos === false} canSubmit={pos !== null && (pos || reason.trim().length > 0)} onSubmit={() => onSubmit(pos as boolean, reason.trim(), staged.files)}>
      <Choice yes={yes} no={no} yesHint={yesHint} noHint={noHint} value={pos} onChange={setPos} />
      {pos !== null && (
        <ReasonField id="wf-reason" label={pos ? "Note" : reasonLabel} value={reason} onChange={setReason} required={!pos} />
      )}
      {evidence && pos !== null && (
        <div className="field">
          <span className="field-label">Evidence<span className="opt">(optional)</span></span>
          <StagedList files={staged.files} onRemove={staged.remove} disabled={shell.busy} />
          <div className="evidence-pick">
            <AttachButton onFiles={staged.add} disabled={shell.busy} label="Add screenshots or logs" ghost={false} />
            <span className="hint">{FILE_HINT}</span>
          </div>
          {staged.problem && <p className="err" role="alert">{staged.problem}</p>}
        </div>
      )}
    </Shell>
  );
}

/** Assignee as a fixed chip, others pickable; warns when the reviewer or tester is among them. */
function ContributorPicker({ t, people, value, onChange, extraBlocked }: {
  t: TicketDetail; people: DirectoryEntry[]; value: number[]; onChange: (v: number[]) => void; extraBlocked?: number | null;
}) {
  const exclude = useMemo(() => {
    const m = new Map<number, string>();
    if (t.reviewer) m.set(t.reviewer.id, "Reviewer — must stay independent");
    if (t.tester) m.set(t.tester.id, "Tester — must stay independent");
    if (extraBlocked != null) m.set(extraBlocked, "Chosen as reviewer");
    return m;
  }, [t.reviewer, t.tester, extraBlocked]);
  const all = [...(t.assignee ? [t.assignee.id] : []), ...value];
  const clashes = all.filter((id) => exclude.has(id)).map((id) => people.find((p) => p.id === id)?.fullName ?? (t.assignee?.id === id ? t.assignee.fullName : "Someone"));
  return (
    <div className="field">
      <span className="field-label">Code contributors</span>
      <div className="chip-row">
        {t.assignee && (
          <span className="picker-chip fixed" title="The assignee is always a contributor">
            <Avatar name={t.assignee.fullName} color={t.assignee.avatarColor} size="xs" /><span dir="auto">{t.assignee.fullName}</span><small>Assignee</small>
          </span>
        )}
      </div>
      <UserPicker multi people={people.filter((p) => p.id !== t.assignee?.id)} value={value} onChange={onChange} exclude={exclude}
        prefer={["DEVELOPER"]} placeholder="Add anyone else who wrote code" />
      {clashes.length > 0 && (
        <p className="err" role="alert">
          {clashes.join(", ")} {clashes.length > 1 ? "are" : "is"} the reviewer or tester, so can&apos;t also be a code contributor. Change that person first.
        </p>
      )}
    </div>
  );
}

function SubmitReviewForm({ t, people, run, ...shell }: ShellProps & { t: TicketDetail; people: DirectoryEntry[]; run: Run }) {
  const [contributors, setContributors] = useState<number[]>(t.contributors.filter((c) => c.id !== t.assignee?.id).map((c) => c.id));
  const [reviewer, setReviewer] = useState<number | null>(null);
  const needsReviewer = !t.reviewer;
  const chosenReviewer = t.reviewer?.id ?? reviewer;
  const contributing = new Set([...(t.assignee ? [t.assignee.id] : []), ...contributors]);
  const clash = (chosenReviewer != null && contributing.has(chosenReviewer)) || (t.tester != null && contributing.has(t.tester.id));
  const reviewerExclude = new Map<number, string>([...contributing].map((id) => [id, "Contributing code — not independent"] as [number, string]));
  if (t.tester) reviewerExclude.set(t.tester.id, "Already the tester");

  return (
    <Shell {...shell} wide title="Submit for review" submit="Submit for review" canSubmit={chosenReviewer != null && !clash}
      description="Say who contributed code. They can't review or test this ticket."
      onSubmit={() => run("submit-review", { contributorIds: contributors, ...(needsReviewer ? { reviewerId: reviewer } : {}) }, "Submitted for review")}>
      <ContributorPicker t={t} people={people} value={contributors} onChange={setContributors} extraBlocked={needsReviewer ? reviewer : null} />
      <div className="field">
        <span className="field-label">Code reviewer</span>
        {needsReviewer ? (
          <UserPicker people={people} value={reviewer} onChange={setReviewer} exclude={reviewerExclude} prefer={["DEVELOPER"]} placeholder="Choose who will review" />
        ) : (
          <div className="chip-row">
            <span className="picker-chip fixed"><Avatar name={t.reviewer!.fullName} color={t.reviewer!.avatarColor} size="xs" /><span dir="auto">{t.reviewer!.fullName}</span></span>
          </div>
        )}
      </div>
    </Shell>
  );
}

function ContributorsForm({ t, people, run, ...shell }: ShellProps & { t: TicketDetail; people: DirectoryEntry[]; run: Run }) {
  const [contributors, setContributors] = useState<number[]>(t.contributors.filter((c) => c.id !== t.assignee?.id).map((c) => c.id));
  const clash = [...(t.assignee ? [t.assignee.id] : []), ...contributors].some((id) => id === t.reviewer?.id || id === t.tester?.id);
  return (
    <Shell {...shell} wide title="Edit code contributors" submit="Save" canSubmit={!clash}
      description="Everyone who wrote code for this fix. The reviewer and tester can't be on the list."
      onSubmit={() => run("contributors", { contributorIds: contributors }, "Contributors updated")}>
      <ContributorPicker t={t} people={people} value={contributors} onChange={setContributors} />
    </Shell>
  );
}

function DeployForm({ t, run, ...shell }: ShellProps & { t: TicketDetail; run: Run }) {
  const [patch, setPatch] = useState(t.patchReference ?? "");
  return (
    <Shell {...shell} title="Mark deployed" submit="Mark deployed" canSubmit={patch.trim().length > 0}
      description="Confirm the patch is live in production. The ticket moves on to Production Verification."
      onSubmit={() => run("mark-deployed", { patchReference: patch.trim() }, "Marked deployed. Waiting for verification")}>
      <div className="field">
        <label htmlFor="wf-patch">Patch reference</label>
        <input id="wf-patch" className="input" value={patch} maxLength={100} onChange={(e) => setPatch(e.target.value)} placeholder="e.g. PATCH-2026-041" />
      </div>
    </Shell>
  );
}

/** Pass closes as Resolved. Fail closes as Unresolved and opens a follow-up ticket that can be reviewed (and edited) first. */
function VerifyForm({ t, people, run, ...shell }: ShellProps & { t: TicketDetail; people: DirectoryEntry[]; run: Run }) {
  const { me } = useSession();
  const [pass, setPass] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [title, setTitle] = useState(("Follow-up: " + t.title).slice(0, 200));
  const [descEdited, setDescEdited] = useState(false);
  const [descText, setDescText] = useState("");
  const [type, setType] = useState<TicketType>(t.type);
  const [priority, setPriority] = useState<Priority>(t.priority);
  const [moduleId, setModuleId] = useState<number>(t.module.id);
  const [env, setEnv] = useState<Environment>(t.environment);
  const [assigneeId, setAssigneeId] = useState<number | null>(t.assignee?.id ?? null);
  const [modules, setModules] = useState<ModuleView[]>([]);
  useEffect(() => { api.get<ModuleView[]>("/api/modules").then(setModules).catch(() => {}); }, []);

  // The description follows the failure reason until the user writes their own.
  const autoDesc = reason.trim() ? `${t.description}\n\n— Production verification failed: ${reason.trim()}` : t.description;
  const description = descEdited ? descText : autoDesc;
  const mayAssign = (me?.permissions["ASSIGN_TICKET"]?.length ?? 0) > 0;
  const moduleOptions = modules.some((m) => m.id === t.module.id)
    ? modules
    : [{ id: t.module.id, name: t.module.name + " (inactive)", nameAr: null, active: false, sortOrder: 0 }, ...modules];
  const tooLong = description.length > 20000;
  const failOk = reason.trim().length > 0 && title.trim().length > 0 && description.trim().length > 0 && !tooLong;

  return (
    <Shell {...shell} wide title="Verify in production" danger={pass === false}
      submit={pass === false ? "Close as Unresolved & open follow-up" : "Pass and close"}
      canSubmit={pass !== null && (pass || failOk)}
      description="Check the fix on the live system."
      onSubmit={() => run("verify", pass ? { result: "PASS", reason: reason.trim() } : {
        result: "FAIL",
        reason: reason.trim(),
        followUp: { title: title.trim(), description: description.trim(), type, priority, moduleId, environment: env, assigneeId, unassigned: assigneeId == null },
      }, "Verified. Ticket resolved")}>
      <Choice yes="Pass" no="Fail" yesHint="Closes as Resolved" noHint="Closes as Unresolved" value={pass} onChange={setPass} />
      {pass === true && <ReasonField id="wf-reason" label="Note" value={reason} onChange={setReason} />}
      {pass === false && (
        <>
          <ReasonField id="wf-reason" label="Failure reason: what's still wrong?" value={reason} onChange={setReason} required />

          <h3 className="tab-h" style={{ margin: "6px 0 -4px" }}>New related ticket</h3>
          <p className="wf-note">
            <Icon name="info" size="sm" />
            <span>{ticketNo(t.id)} will close as <b>Unresolved</b> and stay Unresolved even after the new ticket is fixed.</span>
          </p>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="fu-title">Title</label>
              <input id="fu-title" className={"input" + (isArabic(title) ? " ar" : "")} dir="auto" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field span-2">
              <label htmlFor="fu-desc">Description <span className="opt num">{description.length.toLocaleString()} / 20,000</span></label>
              <textarea id="fu-desc" className={"textarea" + (isArabic(description) ? " ar" : "")} dir="auto" rows={6} value={description}
                onChange={(e) => { setDescText(e.target.value); setDescEdited(true); }} />
              {tooLong && <span className="err">The description is too long. Shorten it before opening the follow-up.</span>}
            </div>
            <div className="field">
              <span className="field-label">Type</span>
              <div className="seg" role="group" aria-label="Type">
                {(Object.keys(TYPE_LABEL) as TicketType[]).map((v) => <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}>{TYPE_LABEL[v]}</button>)}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Environment</span>
              <div className="seg" role="group" aria-label="Environment">
                {(Object.keys(ENV_LABEL) as Environment[]).map((v) => (
                  <button key={v} type="button" aria-pressed={env === v} onClick={() => setEnv(v)}>
                    <span className={"env-dot" + (v === "PRODUCTION" ? " prod" : "")} />{ENV_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field span-2">
              <span className="field-label">Priority</span>
              <div className="prio-pick" role="radiogroup" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={priority === p} className={"prio-opt " + p.toLowerCase()} onClick={() => setPriority(p)}>
                    <PriorityBars level={p} />{PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field span-2">
              <label htmlFor="fu-module">Module</label>
              <select id="fu-module" className="input" value={moduleId} onChange={(e) => setModuleId(Number(e.target.value))}>
                {moduleOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="fu-assignee">Assignee <span className="opt">review before saving</span></label>
              <UserPicker id="fu-assignee" people={people} value={assigneeId} onChange={setAssigneeId} prefer={["DEVELOPER"]}
                disabled={!mayAssign} placeholder="Leave unassigned" />
              {!mayAssign && <span className="hint">You can&apos;t change assignees. The follow-up keeps the current one.</span>}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function BlockForm({ run, ...shell }: ShellProps & { run: Run }) {
  const [reason, setReason] = useState("");
  const [waiting, setWaiting] = useState("");
  const [patch, setPatch] = useState("");
  const no = waiting.trim() ? parseTicketNo(waiting) : null;
  const badNo = waiting.trim().length > 0 && no == null;
  const hasDependency = no != null || patch.trim().length > 0;
  return (
    <Shell {...shell} wide title="Block ticket" submit="Block ticket" canSubmit={reason.trim().length > 0 && hasDependency && !badNo}
      description="Pause the ticket until what it depends on is ready. It goes back to where it was when unblocked."
      onSubmit={() => run("block", { reason: reason.trim(), blockedByTicketId: no, blockPatch: patch.trim() || null }, "Ticket blocked")}>
      <ReasonField id="wf-reason" label="Why is it blocked?" value={reason} onChange={setReason} required />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="wf-waiting">Waiting for ticket<span className="opt">(optional)</span></label>
          <input id="wf-waiting" className="input" inputMode="text" value={waiting} placeholder="1004, #1004 or TKT-1004" onChange={(e) => setWaiting(e.target.value)} aria-invalid={badNo} />
          {badNo && <span className="hint">Enter a ticket number like 1004.</span>}
        </div>
        <div className="field">
          <label htmlFor="wf-bpatch">or waiting for patch<span className="opt">(optional)</span></label>
          <input id="wf-bpatch" className="input" value={patch} maxLength={100} onChange={(e) => setPatch(e.target.value)} placeholder="e.g. PATCH-2026-052" />
        </div>
      </div>
      {!hasDependency && <span className="hint">Say what it&apos;s waiting for: a ticket or a patch.</span>}
    </Shell>
  );
}
