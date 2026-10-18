/* Ticket API types and display labels. Values mirror the backend enums. */

export type TicketType = "BUG" | "CHANGE_REQUEST";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Environment = "PRODUCTION" | "TESTING";
export type Status =
  | "OPEN" | "IN_PROGRESS" | "CODE_REVIEW" | "TESTING" | "READY_FOR_DEPLOYMENT"
  | "DEPLOYED" | "PRODUCTION_VERIFICATION" | "CLOSED" | "BLOCKED";
export type Closure = "RESOLVED" | "UNRESOLVED" | "CANCELLED";

export interface PersonRef { id: number; fullName: string; organization: string | null; avatarColor: string | null; active: boolean }
export interface ModuleRef { id: number; name: string; nameAr: string | null }

export interface TicketCard {
  id: number;
  title: string;
  excerpt: string;
  type: TicketType;
  priority: Priority;
  status: Status;
  closure: Closure | null;
  module: ModuleRef;
  /** null only in the create-form preview, before one is chosen */
  environment: Environment | null;
  creator: PersonRef;
  assignee: PersonRef | null;
  assignedBy: PersonRef | null;
  reviewer: PersonRef | null;
  tester: PersonRef | null;
  patchReference: string | null;
  createdAt: string;
}

export interface PageOf<T> { items: T[]; total: number; page: number; size: number }

export interface LinkView { type: "RELATED" | "FOLLOW_UP_OF" | "BLOCKED_BY"; direction: "OUTGOING" | "INCOMING"; ticket: TicketCard }

export interface ActivityView {
  id: number;
  actor: PersonRef;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  at: string;
}

export interface Abilities {
  edit: boolean; changePriority: boolean; assign: boolean; assignReviewer: boolean;
  assignTester: boolean; addCollaborator: boolean; removeCollaborator: boolean; link: boolean;
}

export interface TicketDetail {
  id: number;
  title: string;
  description: string;
  type: TicketType;
  priority: Priority;
  status: Status;
  statusBeforeBlock: Status | null;
  closure: Closure | null;
  closureReason: string | null;
  module: ModuleRef;
  environment: Environment;
  creator: PersonRef;
  createdAt: string;
  assignee: PersonRef | null;
  assignedBy: PersonRef | null;
  assignedAt: string | null;
  reviewer: PersonRef | null;
  tester: PersonRef | null;
  collaborators: PersonRef[];
  contributors: PersonRef[];
  patchReference: string | null;
  closedBy: PersonRef | null;
  closedAt: string | null;
  links: LinkView[];
  activity: ActivityView[];
  myRelationships: string[];
  can: Abilities;
  version: number;
  updatedAt: string | null;
  testResult: "PASSED" | "FAILED" | null;
  blockReason: string | null;
  blockPatch: string | null;
  blockedBy: PersonRef | null;
  blockedAt: string | null;
  /** Workflow actions the current user can take now (server-computed). */
  actions: WorkflowAction[];
  commentCount: number;
  attachmentCount: number;
  canComment: boolean;
  canUpload: boolean;
  /** Test evidence: only the assigned tester, while the ticket is in testing. */
  canUploadEvidence: boolean;
}

export type AttachmentPurpose = "GENERAL" | "COMMENT" | "EVIDENCE";

export interface AttachmentView {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  purpose: AttachmentPurpose;
  commentId: number | null;
  uploadedBy: PersonRef;
  uploadedAt: string;
  image: boolean;
  can: { delete: boolean };
}

export interface CommentView {
  id: number;
  author: PersonRef;
  /** Empty when the comment was deleted. */
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  attachments: AttachmentView[];
  can: { edit: boolean; delete: boolean };
}

export interface DirectoryEntry { id: number; fullName: string; organization: string; avatarColor: string | null; roles: string[] }

export const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  CODE_REVIEW: "Code Review",
  TESTING: "Testing",
  READY_FOR_DEPLOYMENT: "Ready for Deployment",
  DEPLOYED: "Deployed",
  PRODUCTION_VERIFICATION: "Production Verification",
  CLOSED: "Closed",
  BLOCKED: "Blocked",
};

/** CSS modifier for .status badges (matches the mockup palette). */
export const STATUS_CLASS: Record<Status, string> = {
  OPEN: "s-open",
  IN_PROGRESS: "s-progress",
  CODE_REVIEW: "s-review",
  TESTING: "s-testing",
  READY_FOR_DEPLOYMENT: "s-ready",
  DEPLOYED: "s-deployed",
  PRODUCTION_VERIFICATION: "s-verify",
  CLOSED: "s-closed",
  BLOCKED: "s-blocked",
};

/** The main line of the workflow, in order. BLOCKED is a side state. */
export const WORKFLOW: Status[] = ["OPEN", "IN_PROGRESS", "CODE_REVIEW", "TESTING", "READY_FOR_DEPLOYMENT", "DEPLOYED", "PRODUCTION_VERIFICATION", "CLOSED"];

export const PRIORITY_LABEL: Record<Priority, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export const TYPE_LABEL: Record<TicketType, string> = { BUG: "Bug", CHANGE_REQUEST: "Change request" };
export const ENV_LABEL: Record<Environment, string> = { PRODUCTION: "Production", TESTING: "Testing" };
export const CLOSURE_LABEL: Record<Closure, string> = { RESOLVED: "Resolved", UNRESOLVED: "Unresolved", CANCELLED: "Cancelled" };

export function ticketNo(id: number) { return "TKT-" + id; }

/** True when the text is mainly Arabic, to set dir/lang and the Arabic face. */
export function isArabic(text: string | null | undefined) {
  if (!text) return false;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  const ar = letters.replace(/[^؀-ۿݐ-ݿ]/g, "").length;
  return ar / letters.length > 0.4;
}

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
  return fmtDate(iso);
}

export type WorkflowAction =
  | "start" | "submit-review" | "skip-review" | "review" | "test-result" | "mark-ready" | "mark-deployed"
  | "verify" | "block" | "unblock" | "cancel" | "close" | "contributors";

/** Primary-button label per action. */
export const ACTION_LABEL: Record<WorkflowAction, string> = {
  start: "Start work",
  "submit-review": "Submit for review",
  "skip-review": "Skip code review",
  review: "Review",
  "test-result": "Record test result",
  "mark-ready": "Mark ready for deployment",
  "mark-deployed": "Mark deployed",
  verify: "Verify in production",
  block: "Block ticket",
  unblock: "Unblock",
  cancel: "Cancel ticket",
  close: "Close as unresolved",
  contributors: "Edit code contributors",
};

/** The natural next step, in priority order; the rest go under "More". */
export const PRIMARY_ACTIONS: WorkflowAction[] = ["start", "submit-review", "review", "test-result", "mark-ready", "mark-deployed", "verify", "unblock"];

/** Timeline wording for the workflow's activity actions (the actor's name is shown before it). */
export const WORKFLOW_ACTIVITY: Record<string, string> = {
  REVIEW_SUBMITTED: "submitted the code for review",
  REVIEW_SKIPPED: "skipped code review",
  REVIEW_APPROVED: "approved the code review",
  REVIEW_REJECTED: "rejected the code review",
  TEST_PASSED: "recorded that testing passed",
  TEST_FAILED: "recorded that testing failed",
  DEPLOYED: "marked it deployed",
  VERIFIED: "verified the fix in production",
  VERIFICATION_FAILED: "recorded that production verification failed",
  FOLLOW_UP_CREATED: "opened a follow-up ticket",
  BLOCKED: "blocked the ticket",
  UNBLOCKED: "unblocked the ticket",
  CANCELLED: "cancelled the ticket",
  CLOSED_UNRESOLVED: "closed the ticket as unresolved",
  CONTRIBUTORS_CHANGED: "updated the code contributors",
  COMMENT_ADDED: "added a comment",
  COMMENT_EDITED: "edited a comment",
  COMMENT_DELETED: "deleted a comment",
  ATTACHMENT_ADDED: "added an attachment",
  ATTACHMENT_DELETED: "removed an attachment",
};

/* ---- Files ---- */

/** Mirrors the server's rules so mistakes are caught before an upload; the server still enforces them. */
export const ALLOWED_EXT = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "xls", "xlsx", "csv", "txt", "log", "sql"];
export const MAX_FILE_MB = 20;
export const MAX_FILES = 10;
export const ACCEPT = ALLOWED_EXT.map((e) => "." + e).join(",");
export const FILE_HINT = `PNG, JPG, GIF, WebP, PDF, Excel, CSV, TXT, LOG or SQL · up to ${MAX_FILE_MB} MB each`;

export function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export type FileKind = "image" | "pdf" | "sheet" | "text" | "other";
export function fileKind(name: string): FileKind {
  const e = fileExt(name);
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(e)) return "image";
  if (e === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(e)) return "sheet";
  if (["txt", "log", "sql"].includes(e)) return "text";
  return "other";
}

/** Splits chosen files into the ones that can be sent and friendly reasons for the ones that can't. */
export function checkFiles(incoming: File[], alreadyStaged: number): { ok: File[]; errors: string[] } {
  const ok: File[] = [];
  const errors: string[] = [];
  for (const f of incoming) {
    if (!ALLOWED_EXT.includes(fileExt(f.name))) errors.push(`"${f.name}" isn't an allowed file type.`);
    else if (f.size === 0) errors.push(`"${f.name}" is empty.`);
    else if (f.size > MAX_FILE_MB * 1024 * 1024) errors.push(`"${f.name}" is ${fmtSize(f.size)}; the limit is ${MAX_FILE_MB} MB per file.`);
    else if (alreadyStaged + ok.length >= MAX_FILES) errors.push(`You can attach up to ${MAX_FILES} files at a time.`);
    else ok.push(f);
  }
  return { ok, errors: [...new Set(errors)] };
}

export function attachmentUrl(id: number, inline = false) {
  return `/api/attachments/${id}${inline ? "?inline=1" : ""}`;
}

/** "1004", "#1004" or "TKT-1004" → 1004, else null. */
export function parseTicketNo(text: string): number | null {
  const m = text.trim().match(/^(?:#?\s*TKT-?|#)?\s*(\d{1,12})$/i);
  return m ? Number(m[1]) : null;
}

/* ---- GET /api/tickets/{id}/workflow ---- */

export interface WfStage { status: Status; enteredAt: string; enteredBy: PersonRef | null; note: string | null; leftAt: string | null }
export interface WfCurrent { status: Status; waitingOn: PersonRef | null; waitingFor: string }
export type ReviewDecision = "APPROVED" | "REJECTED" | "SKIPPED";
export interface WfReviewRound {
  submittedAt: string | null; submittedBy: PersonRef | null; contributors: string[] | null;
  decision: ReviewDecision | null; reason: string | null; decidedAt: string | null; decidedBy: PersonRef | null;
}
export interface WfReview {
  reviewer: PersonRef | null; contributors: PersonRef[];
  status: "NOT_SUBMITTED" | "AWAITING" | ReviewDecision; rounds: WfReviewRound[];
}
export interface WfTestRound {
  startedAt: string; result: "PASSED" | "FAILED" | null; notes: string | null;
  testedBy: PersonRef | null; testedAt: string | null; evidence: AttachmentView[];
}
export interface WfTesting { tester: PersonRef | null; status: "NOT_STARTED" | "AWAITING" | "PASSED" | "FAILED"; rounds: WfTestRound[] }
export interface WfVerification { result: "PASSED" | "FAILED"; at: string; by: PersonRef | null; reason: string | null; followUp: TicketCard | null }
export interface WfDeployment {
  patchReference: string | null; readyAt: string | null; readyBy: PersonRef | null;
  deployedAt: string | null; deployedBy: PersonRef | null; verification: WfVerification | null;
}
export interface WfBlock {
  reason: string | null; blockedByTicket: TicketCard | null; blockPatch: string | null;
  blockedAt: string | null; blockedBy: PersonRef | null; unblockedAt: string | null; unblockedBy: PersonRef | null;
  note: string | null; current: boolean;
}
export interface WorkflowData {
  stages: WfStage[]; current: WfCurrent; review: WfReview; testing: WfTesting; deployment: WfDeployment; blocks: WfBlock[];
}

/** Colour token per status, for dots and bars (matches the .status badges). */
export const STATUS_COLOR: Record<Status, string> = {
  OPEN: "var(--st-open)", IN_PROGRESS: "var(--st-progress)", CODE_REVIEW: "var(--st-review)", TESTING: "var(--st-testing)",
  READY_FOR_DEPLOYMENT: "var(--st-ready)", DEPLOYED: "var(--st-deployed)", PRODUCTION_VERIFICATION: "var(--st-verify)",
  CLOSED: "var(--st-closed)", BLOCKED: "var(--st-blocked)",
};

/** "3 min", "4 h 20 min", "2 d 5 h": how long between two instants (to now when `to` is missing). */
export function duration(from: string, to?: string | null) {
  const ms = Math.max(0, (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime());
  const m = Math.floor(ms / 60000);
  if (m < 1) return "under a minute";
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  const d = Math.floor(h / 24);
  return d + " d" + (h % 24 ? " " + (h % 24) + " h" : "");
}
