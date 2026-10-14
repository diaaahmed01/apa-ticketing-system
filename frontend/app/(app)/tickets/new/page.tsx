"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ModuleView } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Icon } from "@/components/Icon";
import { PriorityBars, TicketCardView } from "@/components/TicketBits";
import { UserPicker } from "@/components/UserPicker";
import {
  ENV_LABEL, PRIORITIES, PRIORITY_LABEL, TYPE_LABEL, isArabic,
  type DirectoryEntry, type Environment, type Priority, type TicketCard, type TicketDetail, type TicketType,
} from "@/lib/tickets";

interface Draft {
  title: string;
  description: string;
  type: TicketType;
  priority: Priority;
  moduleId: number | null;
  environment: Environment | null;
  assigneeId: number | null;
  reviewerId: number | null;
  testerId: number | null;
  collaboratorIds: number[];
  patchReference: string;
}

const EMPTY: Draft = {
  title: "", description: "", type: "BUG", priority: "MEDIUM", moduleId: null, environment: null,
  assigneeId: null, reviewerId: null, testerId: null, collaboratorIds: [], patchReference: "",
};

export default function CreateTicketPage() {
  const router = useRouter();
  const { me } = useSession();
  const [d, setD] = useState<Draft>(EMPTY);
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [people, setPeople] = useState<DirectoryEntry[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TicketDetail | null>(null);

  useEffect(() => {
    api.get<ModuleView[]>("/api/modules").then(setModules).catch(() => {});
    api.get<DirectoryEntry[]>("/api/users/directory").then(setPeople).catch(() => {});
  }, []);

  // A permission counts here if granted outright or for the ticket's creator (that's you).
  const may = (p: string) => !!me?.permissions[p]?.some((c) => c === "ALWAYS" || c === "TICKET_CREATOR");
  const mayAssign = !!me?.permissions["ASSIGN_TICKET"]?.includes("ALWAYS");
  const mayReviewer = may("ASSIGN_REVIEWER") || (d.assigneeId === me?.id && !!me?.permissions["ASSIGN_REVIEWER"]?.includes("CURRENT_ASSIGNEE"));
  const mayTester = may("ASSIGN_TESTER");
  const mayCollab = may("COLLAB_ADD");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const problems = {
    title: !d.title.trim() ? "Give the ticket a title." : d.title.length > 200 ? "Keep the title under 200 characters." : null,
    description: !d.description.trim() ? "Describe what happened, where, and how to see it." : null,
    module: d.moduleId == null ? "Choose the module the issue is in." : null,
    environment: d.environment == null ? "Say whether this is in Production or Testing." : null,
  };
  const valid = Object.values(problems).every((p) => !p);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const ref = (id: number | null) => {
    const p = id == null ? null : byId.get(id);
    return p ? { id: p.id, fullName: p.fullName, organization: p.organization, avatarColor: p.avatarColor, active: true } : null;
  };
  const exclusive = (other: number | null, role: string) => new Map(other == null ? [] : [[other, `Already the ${role}`]]);

  const preview: TicketCard = {
    id: created?.id ?? 0,
    title: d.title.trim() || "Ticket title appears here",
    excerpt: d.description.trim() || "The description will read here, exactly as the team will see it on the ticket.",
    type: d.type,
    priority: d.priority,
    status: "OPEN",
    closure: null,
    module: modules.find((m) => m.id === d.moduleId) ?? { id: 0, name: "—", nameAr: null },
    environment: d.environment,
    creator: me ? { id: me.id, fullName: me.fullName, organization: me.organization, avatarColor: me.avatarColor, active: true } : { id: 0, fullName: "You", organization: null, avatarColor: null, active: true },
    assignee: ref(d.assigneeId),
    assignedBy: d.assigneeId != null && me ? { id: me.id, fullName: me.fullName, organization: me.organization, avatarColor: me.avatarColor, active: true } : null,
    reviewer: ref(d.reviewerId),
    tester: ref(d.testerId),
    patchReference: d.patchReference || null,
    createdAt: new Date().toISOString(),
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) {
      document.querySelector<HTMLElement>(".field .invalid")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const t = await api.post<TicketDetail>("/api/tickets", {
        title: d.title, description: d.description, type: d.type, priority: d.priority, moduleId: d.moduleId,
        environment: d.environment, assigneeId: d.assigneeId, reviewerId: d.reviewerId, testerId: d.testerId,
        collaboratorIds: d.collaboratorIds, patchReference: d.patchReference,
      });
      setCreated(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The ticket wasn't created. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <main className="page">
        <div className="issued-wrap">
          <div className="issue-slot" aria-hidden="true" />
          <div className="issued-ticket">
            <TicketCardView t={{ ...preview, id: created.id, title: created.title, excerpt: created.description.slice(0, 240), createdAt: created.createdAt }} preview />
          </div>
          <div className="issued-copy">
            <h1>TKT-{created.id} is open</h1>
            <p>
              {created.assignee ? <>It&apos;s assigned to <b>{created.assignee.fullName}</b>. </> : <>It&apos;s waiting for an assignee. </>}
              Everyone on the ticket can follow it from <b>My Tickets</b>.
            </p>
            <div className="head-actions" style={{ justifyContent: "center" }}>
              <Link className="btn primary" href={`/tickets/${created.id}`}>Open the ticket<Icon name="arrowRight" size="sm" /></Link>
              <button className="btn" type="button" onClick={() => { setCreated(null); setD(EMPTY); setTouched(false); }}>Create another</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Create ticket</h1>
          <p className="sub">Raise a bug or a change request. The ticket on the right is exactly what the team will see.</p>
        </div>
      </div>

      <div className="create-layout">
        <form className="panel create-form" onSubmit={submit} noValidate>
          <section className="form-section">
            <div className="field">
              <label htmlFor="t-title">Title</label>
              <input
                id="t-title"
                className={"input" + (touched && problems.title ? " invalid" : "") + (isArabic(d.title) ? " ar" : "")}
                dir="auto"
                value={d.title}
                maxLength={200}
                onChange={(e) => set("title", e.target.value)}
                placeholder="What's wrong, in one line"
                autoFocus
              />
              {touched && problems.title && <span className="err">{problems.title}</span>}
            </div>
            <div className="field">
              <label htmlFor="t-desc">Description <span className="opt num">{d.description.length.toLocaleString()} / 20,000</span></label>
              <textarea
                id="t-desc"
                className={"textarea" + (touched && problems.description ? " invalid" : "") + (isArabic(d.description) ? " ar" : "")}
                dir="auto"
                rows={6}
                value={d.description}
                maxLength={20000}
                onChange={(e) => set("description", e.target.value)}
                placeholder={"What happened, where, and how to reproduce it.\nArabic or English are both fine."}
              />
              {touched && problems.description && <span className="err">{problems.description}</span>}
            </div>
          </section>

          <section className="form-section grid-2">
            <div className="field">
              <span className="field-label">Type</span>
              <div className="seg" role="group" aria-label="Type">
                {(Object.keys(TYPE_LABEL) as TicketType[]).map((t) => (
                  <button key={t} type="button" aria-pressed={d.type === t} onClick={() => set("type", t)}>{TYPE_LABEL[t]}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Environment</span>
              <div className={"seg" + (touched && problems.environment ? " seg-invalid" : "")} role="group" aria-label="Environment">
                {(Object.keys(ENV_LABEL) as Environment[]).map((v) => (
                  <button key={v} type="button" aria-pressed={d.environment === v} onClick={() => set("environment", v)}>
                    <span className={"env-dot" + (v === "PRODUCTION" ? " prod" : "")} />{ENV_LABEL[v]}
                  </button>
                ))}
              </div>
              {touched && problems.environment && <span className="err">{problems.environment}</span>}
            </div>
            <div className="field span-2">
              <span className="field-label">Priority</span>
              <div className="prio-pick" role="radiogroup" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={d.priority === p} className={"prio-opt " + p.toLowerCase()} onClick={() => set("priority", p)}>
                    <PriorityBars level={p} />{PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field span-2">
              <span className="field-label">Module</span>
              <div className={"module-pick" + (touched && problems.module ? " invalid" : "")} role="radiogroup" aria-label="Module">
                {modules.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={d.moduleId === m.id} onClick={() => set("moduleId", m.id)}>
                    <Icon name="box" size="xs" /><span>{m.name}</span>
                  </button>
                ))}
                {modules.length === 0 && <span className="hint">No active modules. An administrator adds them in Module Management.</span>}
              </div>
              {touched && problems.module && <span className="err">{problems.module}</span>}
            </div>
          </section>

          {(mayAssign || mayReviewer || mayTester || mayCollab) && (
            <section className="form-section grid-2">
              <h2 className="form-h">People</h2>
              {mayAssign && (
                <div className="field">
                  <label htmlFor="t-assignee">Assignee <span className="opt">optional</span></label>
                  <UserPicker id="t-assignee" people={people} value={d.assigneeId} onChange={(v) => set("assigneeId", v)} prefer={["DEVELOPER"]} placeholder="Who will fix it?" />
                </div>
              )}
              {mayReviewer && (
                <div className="field">
                  <label htmlFor="t-reviewer">Code reviewer <span className="opt">when code changes</span></label>
                  <UserPicker id="t-reviewer" people={people} value={d.reviewerId} onChange={(v) => set("reviewerId", v)} prefer={["DEVELOPER"]} exclude={exclusive(d.testerId, "tester")} placeholder="Not one of the code authors" />
                </div>
              )}
              {mayTester && (
                <div className="field">
                  <label htmlFor="t-tester">Tester <span className="opt">optional</span></label>
                  <UserPicker id="t-tester" people={people} value={d.testerId} onChange={(v) => set("testerId", v)} prefer={["TESTER"]} exclude={exclusive(d.reviewerId, "reviewer")} placeholder="Who will verify the fix?" />
                </div>
              )}
              {mayCollab && (
                <div className="field span-2">
                  <label htmlFor="t-collab">Collaborators <span className="opt">optional — they get updates</span></label>
                  <UserPicker id="t-collab" multi people={people} value={d.collaboratorIds} onChange={(v) => set("collaboratorIds", v)} placeholder="Add people to keep in the loop" />
                </div>
              )}
              <p className="hint span-2"><Icon name="info" size="xs" /> The reviewer and tester can&apos;t be anyone who contributes code to the fix. ATS checks this when code is recorded.</p>
            </section>
          )}

          <section className="form-section grid-2">
            <div className="field">
              <label htmlFor="t-patch">Patch reference <span className="opt">optional</span></label>
              <input id="t-patch" className="input" value={d.patchReference} maxLength={100} onChange={(e) => set("patchReference", e.target.value)} placeholder="e.g. PATCH-2026.10.3" />
            </div>
            <div className="field">
              <span className="field-label">Attachments</span>
              <div className="attach-later"><Icon name="clip" size="sm" />Add screenshots and logs on the ticket once it&apos;s created.</div>
            </div>
          </section>

          <div className="form-actions">
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn ghost" type="button" onClick={() => router.back()}>Cancel</button>
            <button className="btn primary lg" type="submit" disabled={busy}>
              <Icon name="ticket" size="sm" />{busy ? "Creating…" : "Create ticket"}
            </button>
          </div>
        </form>

        <aside className="create-preview" aria-label="Live ticket preview">
          <div className="preview-label"><span className="live-dot" />Live preview</div>
          <TicketCardView t={preview} preview />
          <p className="preview-note">The ticket number is issued when you create it.</p>
        </aside>
      </div>
    </main>
  );
}
