"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The ticket silhouette: a paper whose edges are notched wherever a <Perf/> (horizontal
 * perforation) or <VPerf/> (vertical) sits inside it. Notch positions are measured, so
 * they follow content of any height. The outer .tk carries the drop-shadow, which then
 * follows the notches too.
 */
export function TicketPaper({
  children,
  priority,
  className,
  paperClassName,
  hoverable,
  style,
}: {
  children: React.ReactNode;
  priority?: "critical" | "high" | "medium" | "low";
  className?: string;
  paperClassName?: string;
  hoverable?: boolean;
  style?: React.CSSProperties;
}) {
  const paper = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = paper.current;
    if (!el) return;
    const cut = () => cutNotches(el);
    cut();
    const ro = new ResizeObserver(cut);
    ro.observe(el);
    document.fonts?.ready.then(cut);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={["tk", priority ? "p-" + priority : "", hoverable ? "hoverable" : "", className].filter(Boolean).join(" ")}
      style={style}
    >
      <div ref={paper} className={["tk-paper", paperClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </div>
  );
}

/** Horizontal perforation. `notch` limits the cut to one edge (logical start/end). */
export function Perf({ notch }: { notch?: "start" | "end" }) {
  return <div className="perf" data-notch={notch} aria-hidden="true" />;
}

export function VPerf() {
  return <div className="vperf" aria-hidden="true" />;
}

function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0, y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== ancestor) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function cutNotches(paper: HTMLElement) {
  const host = paper.closest(".tk") as HTMLElement | null;
  const r = parseFloat(getComputedStyle(host ?? paper).getPropertyValue("--notch")) || 10;
  const rtl = getComputedStyle(paper).direction === "rtl";
  const hole = (at: string) => `radial-gradient(circle ${r}px at ${at}, #0000 ${r - 0.5}px, #000 ${r}px)`;
  const layers: string[] = [];

  paper.querySelectorAll<HTMLElement>(".perf, .vperf").forEach((p) => {
    if (p.closest(".tk-paper") !== paper || p.offsetParent === null) return;
    const o = offsetWithin(p, paper);
    if (p.classList.contains("perf")) {
      const y = (o.y + 0.75).toFixed(1) + "px";
      const side = p.dataset.notch;
      if (side !== "end") layers.push(hole(`${rtl ? "100%" : "0"} ${y}`));
      if (side !== "start") layers.push(hole(`${rtl ? "0" : "100%"} ${y}`));
    } else {
      const x = (o.x + p.offsetWidth / 2).toFixed(1) + "px";
      layers.push(hole(`${x} 0`), hole(`${x} 100%`));
    }
  });
  paper.style.setProperty("--tk-mask", layers.length ? layers.join(",") : "none");
}
