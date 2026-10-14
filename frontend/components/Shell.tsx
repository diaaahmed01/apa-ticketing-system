"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import { useSession } from "@/lib/session";
import { Avatar, Icon, type IconName } from "./Icon";
import { NotificationBell } from "./NotificationBell";

interface NavItem { href: string; label: string; icon: IconName; permission?: string; soon?: boolean }

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", soon: true },
  { href: "/tickets", label: "All Tickets", icon: "ticket" },
  { href: "/tickets/mine", label: "My Tickets", icon: "mine" },
  { href: "/tickets/new", label: "Create Ticket", icon: "create", permission: "TICKET_CREATE" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "User Management", icon: "users", permission: "USER_VIEW" },
  { href: "/admin/permissions", label: "Roles & Permissions", icon: "shield", permission: "ROLE_PERMISSION_MANAGE" },
  { href: "/admin/modules", label: "Module Management", icon: "layers", permission: "MODULE_MANAGE" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "SETTINGS_MANAGE", soon: true },
];

function readPref(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function writePref(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, can } = useSession();
  const { unread } = useNotifications();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { setCollapsed(readPref("ats-collapsed") === "1"); }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);

  const admin = ADMIN.filter((n) => !n.permission || can(n.permission));
  const main = MAIN.filter((n) => !n.permission || can(n.permission));

  const navLink = (n: NavItem) => {
    const active = n.href === "/tickets"
      ? pathname === "/tickets" || (/^\/tickets\/\d+/.test(pathname))
      : pathname.startsWith(n.href);
    if (n.soon) {
      return (
        <span key={n.href} className="nav-soon" title={`${n.label} — coming in a later build phase`} aria-disabled="true">
          <Icon name={n.icon} />
          <span>{n.label}</span>
          <em className="soon-tag">Soon</em>
        </span>
      );
    }
    return (
      <Link key={n.href} href={n.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} title={n.label}>
        <Icon name={n.icon} />
        <span>{n.label}</span>
        {n.href === "/notifications" && unread > 0 && <span className="count hot">{unread > 99 ? "99+" : unread}</span>}
      </Link>
    );
  };

  return (
    <div className={["app", collapsed ? "collapsed" : "", drawer ? "drawer-open" : ""].filter(Boolean).join(" ")}>
      <aside className="sidebar">
        <Link className="brand" href="/tickets">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8.5a2.5 2.5 0 0 1 0 5V17a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3.5a2.5 2.5 0 0 1 0-5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
              <path d="M8 10h5M8 14h8" />
            </svg>
          </span>
          <span className="brand-text"><strong>APA Ticketing System</strong><span>Port of Alexandria</span></span>
        </Link>
        <nav className="nav" aria-label="Main">
          {main.map(navLink)}
          {admin.length > 0 && <div className="nav-label">Administration</div>}
          {admin.map(navLink)}
        </nav>
        <div className="sidebar-foot">
          <button
            className="collapse-btn"
            type="button"
            onClick={() => { const v = !collapsed; setCollapsed(v); writePref("ats-collapsed", v ? "1" : "0"); }}
          >
            <Icon name="collapse" />
            <span>Collapse</span>
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setDrawer(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" aria-label="Open navigation" onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <label className="global-search">
            <Icon name="search" size="sm" />
            <input type="search" placeholder="Search tickets, people, patches…" aria-label="Global search" disabled title="Search arrives with tickets" />
          </label>
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
