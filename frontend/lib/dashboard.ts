/* Dashboard API types (mirror DashboardService records). */

import type { Environment, ModuleRef, PersonRef, Priority, Status, TicketCard, TicketType } from "./tickets";

export interface Rate { bad: number; good: number; rate: number | null }

export interface DashboardData {
  days: number;
  module: number | null;
  from: string;
  totals: {
    open: number;
    byStatus: Partial<Record<Status, number>>;
    closedInPeriod: { resolved: number; unresolved: number; cancelled: number; total: number };
    createdInPeriod: number;
    criticalOpen: number;
    unassignedOpen: number;
    blocked: number;
  };
  byPriority: Record<Priority, number>;
  byModule: { module: ModuleRef; count: number }[];
  byType: Record<TicketType, number>;
  byEnvironment: Record<Environment, number>;
  trend: { weekStart: string; created: number; closed: number }[];
  quality: { reviewRejection: Rate; testFailure: Rate; verificationFailure: Rate };
  cycle: { medianDays: number | null; averageDays: number | null; count: number };
  myQueue: { ticket: TicketCard; reason: string }[];
  byAssignee: { top: { person: PersonRef; count: number }[]; unassigned: number };
  generatedAt: string;
}

export const PERIODS: { days: number; label: string; long: string }[] = [
  { days: 30, label: "30d", long: "30 days" },
  { days: 90, label: "90d", long: "90 days" },
  { days: 180, label: "6m", long: "6 months" },
  { days: 365, label: "1y", long: "year" },
];
