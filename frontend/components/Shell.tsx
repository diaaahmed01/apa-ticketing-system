"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import { useSession } from "@/lib/session";
import { Avatar, Icon, type IconName } from "./Icon";
import { NotificationBell } from "./NotificationBell";
import { parseTicketNo } from "@/lib/tickets";
import { startProgress } from "./NavProgress";

interface NavItem { href: string; label: string; icon: IconName; permission?: string; soon?: boolean }

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", permission: "DASHBOARD_VIEW" },
  { href: "/tickets", label: "All Tickets", icon: "ticket" },
  { href: "/tickets/mine", label: "My Tickets", icon: "mine" },
  { href: "/tickets/new", label: "Create Ticket", icon: "create", permission: "TICKET_CREATE" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "User Management", icon: "users", permission: "USER_VIEW" },
  { href: "/admin/permissions", label: "Roles & Permissions", icon: "shield", permission: "ROLE_PERMISSION_MANAGE" },
  { href: "/admin/modules", label: "Module Management", icon: "layers", permission: "MODULE_MANAGE" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "SETTINGS_MANAGE" },
];

function readPref(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function writePref(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, can } = useSession();
  const { unread } = useNotifications();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [hover, setHover] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const placed = useRef<{ path: string | null }>({ path: null });

  useEffect(() => { setCollapsed(readPref("ats-collapsed") === "1"); }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);

  // Under 1080px the sidebar is a drawer; hover-expand doesn't apply there.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1080px)");
    const on = () => { setNarrow(mq.matches); if (mq.matches) setHover(false); };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => () => { clearTimeout(enterTimer.current); clearTimeout(leaveTimer.current); }, []);

  const peek = collapsed && hover && !narrow;

  function peekIn(delay: number) {
    clearTimeout(leaveTimer.current);
    if (narrow || !collapsed || hover) return;
    clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => setHover(true), delay);
  }
  function peekOut() {
    clearTimeout(enterTimer.current);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHover(false), 200);
  }

  // Slide the pill to the active link. Measured from the link's offsetTop/offsetHeight inside .nav (position: relative),
  // so it is right in both widths and when the list scrolls. Only a route change animates; everything else snaps.
  const placePill = useCallback((animate: boolean) => {
    const pill = pillRef.current;
    const nav = navRef.current;
    if (!pill || !nav) return;
    const a = nav.querySelector<HTMLElement>("a.active");
    pill.style.transition = animate ? "" : "none";
    if (!a) { pill.style.opacity = "0"; return; }
    pill.style.height = a.offsetHeight + "px";
    pill.style.transform = `translateY(${a.offsetTop}px)`;
    pill.style.opacity = "1";
  }, []);

  useLayoutEffect(() => {
    const animate = placed.current.path !== null && placed.current.path !== pathname;
    placed.current.path = pathname;
    placePill(animate);
  }, [pathname, me, placePill]);

  // Collapse, pin, hover and resize change item positions (the admin label's height eases); follow them without animating.
  useLayoutEffect(() => {
    placePill(false);
    let frame = 0;
    const start = performance.now();
    const tick = () => { placePill(false); if (performance.now() - start < 340) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    const onResize = () => placePill(false);
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); };
  }, [collapsed, peek, drawer, narrow, placePill]);

  const admin = ADMIN.filter((n) => !n.permission || can(n.permission));
  const main = MAIN.filter((n) => !n.permission || can(n.permission));

  const navLink = (n: NavItem, i: number) => {
    const stagger = { ["--i" as string]: i } as React.CSSProperties;
    const active = n.href === "/tickets"
      ? pathname === "/tickets" || (/^\/tickets\/\d+/.test(pathname))
      : pathname.startsWith(n.href);
    if (n.soon) {
      return (
        <span key={n.href} className="nav-soon" style={stagger} title={`${n.label} — coming in a later build phase`} aria-disabled="true">
          <Icon name={n.icon} />
          <span>{n.label}</span>
          <em className="soon-tag">Soon</em>
        </span>
      );
    }
    return (
      <Link key={n.href} href={n.href} style={stagger} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} title={n.label}>
        <Icon name={n.icon} />
        <span>{n.label}</span>
        {n.href === "/notifications" && unread > 0 && <span className="count hot">{unread > 99 ? "99+" : unread}</span>}
      </Link>
    );
  };

  return (
    <div className={["app", collapsed ? "collapsed" : "", peek ? "peek" : "", drawer ? "drawer-open" : ""].filter(Boolean).join(" ")}>
      <aside
        className="sidebar"
        onMouseEnter={() => peekIn(150)}
        onMouseLeave={peekOut}
        onFocus={(e) => { if (e.target.matches(":focus-visible")) { clearTimeout(leaveTimer.current); if (collapsed && !narrow) setHover(true); } }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) peekOut(); }}
      >
        <div className="sidebar-head">
        <Link className="brand" href="/tickets">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8.5a2.5 2.5 0 0 1 0 5V17a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3.5a2.5 2.5 0 0 1 0-5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
              <path d="M8 10h5M8 14h8" />
            </svg>
          </span>
          <span className="brand-text"><strong>APA Ticketing System</strong><span>Port of Alexandria</span></span>
        </Link>
          <button
            className="collapse-btn"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => { const v = !collapsed; setCollapsed(v); writePref("ats-collapsed", v ? "1" : "0"); }}
          >
            <Icon name="collapse" />
          </button>
        </div>
        <nav className="nav" aria-label="Main" ref={navRef}>
          <span className="nav-pill" ref={pillRef} aria-hidden="true" />
          {main.map((n, i) => navLink(n, i))}
          {admin.length > 0 && <div className="nav-label" style={{ ["--i" as string]: main.length } as React.CSSProperties}>Administration</div>}
          {admin.map((n, i) => navLink(n, main.length + 1 + i))}
        </nav>
      </aside>
      <div className="scrim" onClick={() => setDrawer(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" aria-label="Open navigation" onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <GlobalSearch />
          <div className="top-actions">
            <NotificationBell />
            {me && <ProfileMenu name={me.fullName} color={me.avatarColor} role={me.roles[0]?.name ?? ""} />}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Enter opens a ticket by number or searches the list; "/" focuses the box from anywhere outside a field. Under 720px a search button opens a full-width field instead. */
function GlobalSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      if (window.matchMedia("(max-width: 720px)").matches) setMobileOpen(true);
      else ref.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (mobileOpen) mobileRef.current?.focus(); }, [mobileOpen]);

  function go(input: HTMLInputElement | null) {
    const text = input?.value.trim() ?? "";
    if (!text) return false;
    const no = parseTicketNo(text);
    const target = no !== null ? `/tickets/${no}` : "/tickets?q=" + encodeURIComponent(text);
    if (target !== location.pathname + location.search) startProgress();
    router.push(target);
    return true;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (go(ref.current)) ref.current?.blur();
  }

  function submitMobile(e: React.FormEvent) {
    e.preventDefault();
    if (go(mobileRef.current)) setMobileOpen(false);
  }

  function closeMobile() {
    setMobileOpen(false);
    openerRef.current?.focus();
  }

  return (
    <>
      <form className="global-search" role="search" onSubmit={submit}>
        <Icon name="search" size="sm" />
        <input ref={ref} type="search" placeholder="Search tickets or TKT-number…" aria-label="Search tickets" aria-keyshortcuts="/" enterKeyHint="search" />
        <kbd aria-hidden="true">/</kbd>
      </form>
      <button ref={openerRef} className="icon-btn search-btn" type="button" aria-label="Search tickets" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
        <Icon name="search" />
      </button>
      {mobileOpen && (
        <form className="search-overlay" role="search" onSubmit={submitMobile}>
          <Icon name="search" size="sm" />
          <input
            ref={mobileRef}
            type="search"
            placeholder="Search tickets or TKT-number…"
            aria-label="Search tickets"
            enterKeyHint="search"
            onBlur={() => setMobileOpen(false)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeMobile(); } }}
          />
          <button className="icon-btn" type="button" aria-label="Close search" onMouseDown={(e) => e.preventDefault()} onClick={closeMobile}>
            <Icon name="x" />
          </button>
        </form>
      )}
    </>
  );
}

function ProfileMenu({ name, color, role }: { name: string; color: string | null; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  async function signOut() {
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/login");
  }

  return (
    <div className="profile-wrap" ref={ref}>
      <button className="profile" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Avatar name={name} color={color} />
        <span className="who"><strong>{name}</strong><span>{role}</span></span>
        <Icon name="chevDown" size="sm" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <Link role="menuitem" href="/change-password" className="menu-item"><Icon name="key" size="sm" />Change password</Link>
          <button role="menuitem" type="button" className="menu-item" onClick={signOut}><Icon name="logout" size="sm" />Sign out</button>
        </div>
      )}
    </div>
  );
}
