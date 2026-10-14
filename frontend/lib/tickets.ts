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
