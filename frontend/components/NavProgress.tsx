"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/**
 * A thin Electric Blue bar at the top of the window. It starts the moment an internal link is clicked
 * (or `startProgress()` is called before a router.push) and finishes once the URL has changed.
 */

let begin: (() => void) | null = null;

/** Call right before a programmatic navigation (router.push) so the bar starts at once. */
export function startProgress() {
  begin?.();
}

const GIVE_UP_MS = 12_000;

export function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [on, setOn] = useState(false);
  const [p, setP] = useState(0);
  const active = useRef(false);
  const timers = useRef<{ trickle?: ReturnType<typeof setInterval>; fade?: ReturnType<typeof setTimeout>; giveUp?: ReturnType<typeof setTimeout> }>({});
  const where = useRef(pathname + "?" + search);

  function clear() {
    clearInterval(timers.current.trickle);
    clearTimeout(timers.current.fade);
    clearTimeout(timers.current.giveUp);
  }

  function finish() {
    if (!active.current) return;
    active.current = false;
    clear();
    setP(1);
    timers.current.fade = setTimeout(() => {
      setOn(false);
      timers.current.fade = setTimeout(() => setP(0), 350);
    }, 180);
  }

  function start() {
    if (active.current) return;
    active.current = true;
    clear();
    setP(0.08);
    setOn(true);
    timers.current.trickle = setInterval(() => setP((v) => (v < 0.9 ? v + (0.9 - v) * 0.12 : v)), 220);
    timers.current.giveUp = setTimeout(finish, GIVE_UP_MS);
  }

  // The URL changed: the new page is in.
  useEffect(() => {
    const next = pathname + "?" + search;
    if (next !== where.current) {
      where.current = next;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    begin = start;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.dataset.noProgress !== undefined) return;
      let url: URL;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page, nothing will change
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (begin === start) begin = null;
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"nav-progress" + (on ? " on" : "")} role="presentation" aria-hidden="true">
      <i style={{ ["--p" as string]: p }} />
    </div>
  );
}
