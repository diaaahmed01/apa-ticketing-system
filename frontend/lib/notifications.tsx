"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { IconName } from "@/components/Icon";
import { api } from "./api";
import { useSession } from "./session";
import { fmtDate, type PersonRef } from "./tickets";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  ticketId: number | null;
  actor: PersonRef | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationPage { items: NotificationItem[]; total: number; unread: number }

const POLL_MS = 30_000;

interface Ctx {
  unread: number;
  /** Re-reads the unread count from the server. */
  refresh: () => Promise<void>;
  setUnread: (n: number) => void;
}

const NotificationsCtx = createContext<Ctx | null>(null);

/** Holds the unread count for the bell and the nav tag; polls while the tab is visible and on focus. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const [unread, setUnread] = useState(0);
  const userId = me?.id ?? null;

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ unread: number }>("/api/notifications/unread-count");
      setUnread(r.unread);
    } catch { /* keep the last known count; the next poll tries again */ }
  }, []);

  useEffect(() => {
    if (userId == null) return;
    refresh();
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId, refresh]);

  const value = useMemo(() => ({ unread, refresh, setUnread }), [unread, refresh]);
  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications(): Ctx {
  const c = useContext(NotificationsCtx);
  if (!c) throw new Error("useNotifications must be used inside NotificationsProvider");
  return c;
}

/* ---- Presentation ---- */

export type Tone = "blue" | "green" | "red" | "amber" | "purple" | "grey";

const META: Record<string, { icon: IconName; tone: Tone }> = {
  ASSIGNED: { icon: "userPlus", tone: "blue" },
  REVIEWER_ASSIGNED: { icon: "eye", tone: "purple" },
  TESTER_ASSIGNED: { icon: "flask", tone: "amber" },
  COLLABORATOR_ADDED: { icon: "users", tone: "blue" },
  REVIEW_REQUESTED: { icon: "pr", tone: "purple" },
  REVIEW_APPROVED: { icon: "checkCircle", tone: "green" },
  REVIEW_REJECTED: { icon: "alert", tone: "red" },
  TEST_REQUESTED: { icon: "flask", tone: "amber" },
  TEST_PASSED: { icon: "checkCircle", tone: "green" },
  TEST_FAILED: { icon: "alert", tone: "red" },
  STATUS_CHANGED: { icon: "arrowRight", tone: "grey" },
  VERIFY_REQUESTED: { icon: "rocket", tone: "blue" },
  BLOCKED: { icon: "blocked", tone: "red" },
  UNBLOCKED: { icon: "unlock", tone: "green" },
  BLOCKER_CLOSED: { icon: "unlock", tone: "blue" },
  COMMENT_ADDED: { icon: "message", tone: "blue" },
  FOLLOW_UP_CREATED: { icon: "link", tone: "purple" },
};

export function typeMeta(type: string): { icon: IconName; tone: Tone } {
  return META[type] ?? { icon: "bell", tone: "grey" };
}

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

/** "Today", "Yesterday", or the date. */
export function dayLabel(iso: string): string {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return fmtDate(iso);
}

/** Groups already-sorted items by calendar day, keeping order. */
export function groupByDay(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}
