"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { groupByDay, typeMeta, useNotifications, type NotificationItem, type NotificationPage } from "@/lib/notifications";
import { relTime, ticketNo } from "@/lib/tickets";
import { Avatar, Icon } from "@/components/Icon";
import { startProgress } from "@/components/NavProgress";
import { RowsSkeleton } from "@/components/Skeletons";
import { Spinner } from "@/components/Spinner";
import { toast } from "@/components/Toast";

const PAGE = 20;
type Filter = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const { unread, setUnread, refresh } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = useRef(0); // ignores answers to a filter the user has already left

  const fetchPage = useCallback(async (f: Filter, page: number) => {
    return api.get<NotificationPage>(`/api/notifications?unread=${f === "unread"}&page=${page}&size=${PAGE}`);
  }, []);

  const load = useCallback(async (f: Filter) => {
    const mine = ++run.current;
    setItems(null);
    setLoadError(null);
    try {
      const r = await fetchPage(f, 0);
      if (mine !== run.current) return;
      setItems(r.items);
      setTotal(r.total);
      setUnread(r.unread);
    } catch (e) {
      if (mine !== run.current) return;
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load notifications.");
    }
  }, [fetchPage, setUnread]);

  useEffect(() => { load(filter); }, [filter, load]);

  async function loadMore() {
    if (!items) return;
    const mine = run.current;
    setMore(true);
    try {
      const r = await fetchPage(filter, Math.floor(items.length / PAGE));
      if (mine !== run.current) return;
      // A page boundary can shift if new notifications arrived; keep each one once.
      setItems((cur) => {
        const seen = new Set((cur ?? []).map((n) => n.id));
        return [...(cur ?? []), ...r.items.filter((n) => !seen.has(n.id))];
      });
      setTotal(r.total);
      setUnread(r.unread);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't load more.", "error");
    } finally {
      setMore(false);
    }
  }

  function open(n: NotificationItem) {
    if (!n.read) {
      setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? l);
      setUnread(Math.max(0, unread - 1));
      api.post<{ unread: number }>(`/api/notifications/${n.id}/read`).then((r) => setUnread(r.unread)).catch(() => refresh());
    }
    if (n.ticketId != null) { startProgress(); router.push(`/tickets/${n.ticketId}`); }
  }

  async function readAll() {
    setBusy(true);
    try {
      await api.post("/api/notifications/read-all");
      setUnread(0);
      if (filter === "unread") await load("unread");
      else setItems((l) => l?.map((x) => ({ ...x, read: true })) ?? l);
      toast("All caught up");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't mark them as read.", "error");
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => (items ? groupByDay(items) : []), [items]);

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="sub">
            {unread > 0 ? <><b className="num">{unread}</b> unread</> : "You're all caught up."}
          </p>
        </div>
        <div className="head-actions">
          <div className="seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
            <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>
              Unread{unread > 0 && <span className="nt-seg-n">{unread > 99 ? "99+" : unread}</span>}
            </button>
          </div>
          <button className={"btn" + (busy ? " is-busy" : "")} type="button" onClick={readAll} disabled={busy || unread === 0}>
            {busy ? <Spinner /> : <Icon name="checks" size="sm" />}Mark all as read
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="empty panel"><h3>Notifications didn&apos;t load</h3><p>{loadError}</p><button className="btn" type="button" onClick={() => load(filter)}>Try again</button></div>
      ) : !items ? (
        <RowsSkeleton rows={7} />
      ) : items.length === 0 ? (
        <div className="empty panel">
          <Icon name={filter === "unread" ? "checkCircle" : "inbox"} />
          {filter === "unread" ? (
            <>
              <h3>Nothing unread</h3>
              <p>You&apos;ve seen everything. New activity on your tickets will show up here.</p>
              <button className="btn" type="button" onClick={() => setFilter("all")}>Show all notifications</button>
            </>
          ) : (
            <>
              <h3>No notifications yet</h3>
              <p>You&apos;ll be told here when a ticket is assigned to you, needs your review or testing, or gets a comment.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.label} className="nt-group" aria-label={g.label}>
              <h2 className="nt-day">{g.label}</h2>
              <ul className="nt-list panel">
                {g.items.map((n) => {
                  const m = typeMeta(n.type);
                  return (
                    <li key={n.id}>
                      <button type="button" className={"nt-row" + (n.read ? "" : " unread")} onClick={() => open(n)}>
                        <span className={"nt-ico t-" + m.tone}><Icon name={m.icon} size="sm" /></span>
                        <span className="nt-main">
                          <span className="nt-title">{n.title}</span>
                          {n.body && <span className="nt-body" dir="auto">{n.body}</span>}
                          <span className="nt-meta">
                            {n.ticketId != null && <span className="id-chip">{ticketNo(n.ticketId)}</span>}
                            {n.actor && <span className="nt-actor"><Avatar name={n.actor.fullName} color={n.actor.avatarColor} size="xs" />{n.actor.fullName}</span>}
                            <time dateTime={n.createdAt}>{relTime(n.createdAt)}</time>
                          </span>
                        </span>
                        {!n.read && <><i className="nt-dot" aria-hidden="true" /><span className="sr-only">Unread</span></>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {items.length < total && (
            <div className="nt-more">
              <button className={"btn" + (more ? " is-busy" : "")} type="button" onClick={loadMore} disabled={more}>{more && <Spinner />}{more ? "Loading…" : "Load more"}</button>
              <span className="muted">Showing {items.length} of {total}</span>
            </div>
          )}
        </>
      )}
    </main>
  );
}
