"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "ok" | "error" };
let push: ((t: Omit<Toast, "id">) => void) | null = null;

/** Fire-and-forget status message. */
export function toast(message: string, tone: Toast["tone"] = "ok") {
  push?.({ message, tone });
}

export function ToastHost() {
  const [current, setCurrent] = useState<Toast | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    push = (t) => {
      setCurrent({ ...t, id: Date.now() });
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), 3200);
    };
    return () => { push = null; clearTimeout(timer); };
  }, []);

  return (
    <div className={"toast" + (shown ? " show" : "") + (current?.tone === "error" ? " error" : "")} role="status" aria-live="polite">
      {current && (
        <>
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            {current.tone === "error" ? <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></> : <path d="M20 6 9 17l-5-5" />}
          </svg>
          <span>{current.message}</span>
        </>
      )}
    </div>
  );
}
