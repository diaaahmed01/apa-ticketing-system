"use client";

import { useEffect, useRef } from "react";

/** Native <dialog> modal: focus trap, Escape and backdrop come from the browser. */
export function Modal({
  open, onClose, title, description, children, footer, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      style={wide ? { width: "min(640px, calc(100vw - 32px))" } : undefined}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <>
          <div className="modal-head">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {children && <div className="modal-body">{children}</div>}
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
