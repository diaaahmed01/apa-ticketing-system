"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";
import { ACCEPT, attachmentUrl, checkFiles, fileKind, fmtSize, type AttachmentView } from "@/lib/tickets";

/* Shared file pieces: choosing and staging files, file chips, thumbnails and the image preview. */

const KIND_ICON: Record<ReturnType<typeof fileKind>, IconName> = {
  image: "image", pdf: "fileText", sheet: "sheet", text: "fileText", other: "file",
};

export function FileIcon({ name, size }: { name: string; size?: "sm" | "xs" }) {
  const kind = fileKind(name);
  return <span className={"file-ico k-" + kind}><Icon name={KIND_ICON[kind]} size={size} /></span>;
}

/** Files picked for the next send: checked as they arrive, with a friendly note for any that were refused. */
export function useStagedFiles() {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const cur = useRef<File[]>([]);

  const set = (next: File[]) => { cur.current = next; setFiles(next); };
  const add = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;
    const r = checkFiles(incoming, cur.current.length);
    setProblem(r.errors.length ? r.errors.join(" ") : null);
    if (r.ok.length) set([...cur.current, ...r.ok]);
  }, []);
  const remove = useCallback((i: number) => { setProblem(null); set(cur.current.filter((_, k) => k !== i)); }, []);
  const clear = useCallback(() => { setProblem(null); set([]); }, []);
  return { files, problem, add, remove, clear };
}

/** A pasted screenshot is always called "image.png"; give it a name that tells pastes apart. */
export function namePasted(f: File, i: number) {
  if (!/^image\.(png|jpe?g|gif|webp)$/i.test(f.name)) return f;
  const ext = f.name.split(".").pop();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
  return new File([f], `pasted-${stamp}${i ? "-" + (i + 1) : ""}.${ext}`, { type: f.type });
}

/** Opens the system file picker. */
export function AttachButton({ onFiles, disabled, label = "Attach", ghost = true }: {
  onFiles: (files: File[]) => void; disabled?: boolean; label?: string; ghost?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" multiple accept={ACCEPT} hidden tabIndex={-1}
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <button className={"btn sm" + (ghost ? " ghost" : "")} type="button" disabled={disabled} onClick={() => input.current?.click()}>
        <Icon name="clip" size="sm" />{label}
      </button>
    </>
  );
}

/** Chosen files before sending, each removable. */
export function StagedList({ files, onRemove, disabled }: { files: File[]; onRemove: (i: number) => void; disabled?: boolean }) {
  if (files.length === 0) return null;
  return (
    <ul className="staged" aria-label="Files to attach">
      {files.map((f, i) => (
        <li key={f.name + i + f.size} className="staged-item">
          <Thumb file={f} />
          <span className="staged-name" dir="auto" title={f.name}>{f.name}</span>
          <small className="num">{fmtSize(f.size)}</small>
          <button type="button" aria-label={`Remove ${f.name}`} disabled={disabled} onClick={() => onRemove(i)}><Icon name="x" size="xs" /></button>
        </li>
      ))}
    </ul>
  );
}

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const image = fileKind(file.name) === "image";
  useEffect(() => {
    if (!image) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, image]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="staged-thumb" src={url} alt="" /> : <FileIcon name={file.name} size="sm" />;
}

/** An attachment of a comment: image thumbnail (opens the preview) or a file chip (downloads). */
export function AttachmentChip({ a, onPreview }: { a: AttachmentView; onPreview: (a: AttachmentView) => void }) {
  if (a.image) {
    return (
      <button type="button" className="thumb" onClick={() => onPreview(a)} aria-label={`Preview ${a.fileName}`} title={a.fileName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachmentUrl(a.id, true)} alt={a.fileName} loading="lazy" />
      </button>
    );
  }
  return (
    <a className="file-chip" href={attachmentUrl(a.id)} download={a.fileName} title={`Download ${a.fileName}`}>
      <FileIcon name={a.fileName} size="sm" />
      <span className="file-chip-name" dir="auto">{a.fileName}</span>
      <small className="num">{fmtSize(a.size)}</small>
    </a>
  );
}

/** Large image preview with a download button. */
export function Lightbox({ file, onClose }: { file: AttachmentView | null; onClose: () => void }) {
  return (
    <Modal open={!!file} onClose={onClose} wide title={file?.fileName ?? ""}
      footer={file && (
        <>
          <button className="btn ghost" type="button" onClick={onClose}>Close</button>
          <a className="btn primary" href={attachmentUrl(file.id)} download={file.fileName}><Icon name="download" size="sm" />Download</a>
        </>
      )}
    >
      {file && (
        <div className="lightbox">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachmentUrl(file.id, true)} alt={file.fileName} />
        </div>
      )}
    </Modal>
  );
}

/** Drag-and-drop target. Dragging only highlights it while files are over it. */
export function useDropZone(onFiles: (files: File[]) => void, disabled?: boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  return {
    over,
    props: {
      onDragEnter: (e: React.DragEvent) => { if (disabled || !hasFiles(e)) return; e.preventDefault(); depth.current++; setOver(true); },
      onDragOver: (e: React.DragEvent) => { if (disabled || !hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
      onDragLeave: (e: React.DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); },
      onDrop: (e: React.DragEvent) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}
