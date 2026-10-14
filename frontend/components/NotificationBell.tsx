"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useNotifications, typeMeta, type NotificationItem, type NotificationPage } from "@/lib/notifications";
import { relTime } from "@/lib/tickets";
import { Avatar, Icon } from "./Icon";
import { toast } from "./Toast";

const LATEST = 8;

/** Topbar bell: unread badge, and a dropdown with the latest notifications. */
export function NotificationBell() {
  const router = useRouter();
  const { unread, setUnread, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const load = useCallback(async () => {
    try {
      const r = await api.get<NotificationPage>(`/api/notifications?size=${LATEST}`);
      setItems(r.items);
      setUnread(r.unread);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load notifications.");
    }
  }, [setUnread]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setError(null);
    load();
    panel.current?.focus();
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open, load]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const rows = Array.from(panel.current?.querySelectorAll<HTMLElement>(".nt-item") ?? []);
      if (rows.length === 0) return;
      e.preventDefault();
      const at = rows.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (at + 1) % rows.length : (at <= 0 ? rows.length - 1 : at - 1);
      rows[next].focus();
    }
  }

  // Close when focus leaves the bell and its panel (keyboard Tab out); clicks elsewhere are handled above.
  function onBlur(e: React.FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (open && to && !wrap.current?.contains(to)) setOpen(false);
  }

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? l);
      setUnread(Math.max(0, unread - 1));
      api.post<{ unread: number }>(`/api/notifications/${n.id}/read`).then((r) => setUnread(r.unread)).catch(() => refresh());
    }
    if (n.ticketId != null) router.push(`/tickets/${n.ticketId}`);
  }

  async function readAll() {
    try {
      await api.post("/api/notifications/read-all");
      setItems((l) => l?.map((x) => ({ ...x, read: true })) ?? l);
      setUnread(0);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't mark them as read.", "error");
    }
  }

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div className="bell-wrap" ref={wrap} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={button}
        className="icon-btn"
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="bell-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" id={panelId} ref={panel} role="dialog" aria-label="Notifications" tabIndex={-1}>
          <div className="bell-head">
            <h2>Notifications</h2>
            {unread > 0 && <span className="bell-count">{unread} unread</span>}
          </div>

          <div className="bell-body">
            {error ? (
              <div className="bell-empty">
                <p>{error}</p>
                <button className="btn sm" type="button" onClick={() => { setError(null); load(); }}>Try again</button>
              </div>
            ) : !items ? (
              <div className="skeleton-rows">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" />)}</div>
            ) : items.length === 0 ? (
              <div className="bell-empty">
                <Icon name="inbox" />
                <p>No notifications yet. You&apos;ll hear about assignments, reviews and comments here.</p>
              </div>
            ) : (
              <ul className="bell-list">
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" className={"nt-item" + (n.read ? "" : " unread")} onClick={() => openItem(n)}>
                      {n.actor
                        ? <Avatar name={n.actor.fullName} color={n.actor.avatarColor} />
                        : <span className={"nt-ico t-" + typeMeta(n.type).tone}><Icon name={typeMeta(n.type).icon} size="sm" /></span>}
                      <span className="nt-text">
                        <span className="nt-title">{n.title}</span>
                        {n.body && <span className="nt-body" dir="auto">{n.body}</span>}
                        <span className="nt-time">{relTime(n.createdAt)}</span>
                      </span>
                      {!n.read && <><i className="nt-dot" aria-hidden="true" /><span className="sr-only">Unread</span></>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bell-foot">
            <button className="btn ghost sm" type="button" onClick={readAll} disabled={unread === 0}>
              <Icon name="checks" size="sm" />Mark all as read
            </button>
            <Link className="btn sm" href="/notifications" onClick={() => setOpen(false)}>View all</Link>
          </div>
        </div>
      )}
    </div>
  );
}
