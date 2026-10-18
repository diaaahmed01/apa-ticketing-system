"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Avatar, Icon, type IconName } from "./Icon";
import { AttachButton, AttachmentChip, FileIcon, Lightbox, StagedList, namePasted, useDropZone, useStagedFiles } from "./FileBits";
import { Modal } from "./Modal";
import { CommentsSkeleton, RowsSkeleton } from "./Skeletons";
import { Spinner } from "./Spinner";
import { toast } from "./Toast";
import {
  FILE_HINT, attachmentUrl, checkFiles, fmtDate, fmtSize, isArabic, relTime,
  type AttachmentView, type CommentView, type PersonRef, type TicketDetail,
} from "@/lib/tickets";

const MAX_COMMENT = 10000;

const orgTag = (p: PersonRef) => (p.organization === "VENDOR" ? "HQ" : "Port");

function message(e: unknown, fallback = "That didn't work. Try again.") {
  return e instanceof ApiError ? e.message : fallback;
}

/** Loads a list for the ticket; reloads when the counts change (something was added or removed elsewhere). */
function useList<T>(url: string, deps: unknown[]) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setItems(await api.get<T[]>(url));
      setError(null);
    } catch (e) {
      setError(message(e, "Couldn't load this list."));
    }
  }, [url]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, ...deps]);
  return { items, setItems, error, reload: load };
}

/** Textarea that grows with its text, up to a limit. */
function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, max = 280) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight + 2, max) + "px";
  }, [ref, value, max]);
}

/* ------------------------------------------------------------------ comments */

export function CommentsTab({ t, onChanged }: { t: TicketDetail; onChanged: () => void }) {
  const { items, setItems, error, reload } = useList<CommentView>(`/api/tickets/${t.id}/comments`, [t.commentCount, t.attachmentCount]);
  const [preview, setPreview] = useState<AttachmentView | null>(null);
  const [deleting, setDeleting] = useState<CommentView | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(c: CommentView) {
    setBusy(true);
    try {
      await api.del(`/api/comments/${c.id}`);
      toast("Comment deleted");
      setDeleting(null);
      reload();
      onChanged();
    } catch (e) {
      toast(message(e), "error");
      if (e instanceof ApiError && (e.code === "TICKET_CLOSED" || e.code === "NOT_FOUND")) { setDeleting(null); reload(); onChanged(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tab-panel cm-tab" aria-label="Comments">
      {error && <p className="err" role="alert"><Icon name="alert" size="xs" />{error}</p>}
      {!items && !error && <CommentsSkeleton />}
      {items && items.length === 0 && (
        <div className="empty panel">
          <Icon name="message" />
          <h3>No comments yet</h3>
          <p>Comments are visible to everyone who can see this ticket. Use them to ask questions, share findings, or hand over context.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <ol className="cm-list">
          {items.map((c) => (
            <li key={c.id}>
              <Comment c={c} onPreview={setPreview} onDelete={() => setDeleting(c)}
                onSaved={(saved) => setItems((cur) => cur && cur.map((x) => (x.id === saved.id ? saved : x)))}
                onGone={() => { reload(); onChanged(); }} />
            </li>
          ))}
        </ol>
      )}

      <Composer t={t} onPosted={(c) => { setItems((cur) => [...(cur ?? []), c]); onChanged(); }} />

      <Lightbox file={preview} onClose={() => setPreview(null)} />
      <Modal open={!!deleting} onClose={() => { if (!busy) setDeleting(null); }} title="Delete this comment?"
        description="It will show as deleted for everyone, and any files sent with it are removed from the ticket."
        footer={<>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button>
          <button className={"btn danger" + (busy ? " is-busy" : "")} type="button" disabled={busy} onClick={() => deleting && remove(deleting)}>{busy && <Spinner />}{busy ? "Deleting…" : "Delete comment"}</button>
        </>}
      />
    </section>
  );
}

function Comment({ c, onPreview, onDelete, onSaved, onGone }: {
  c: CommentView; onPreview: (a: AttachmentView) => void; onDelete: () => void; onSaved: (c: CommentView) => void; onGone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const rtl = isArabic(c.body);
  return (
    <article className={"cm" + (c.deleted ? " is-deleted" : "")} id={`comment-${c.id}`} tabIndex={-1}>
      <Avatar name={c.author.fullName} color={c.author.avatarColor} size="lg" />
      <div className="cm-main">
        <header className="cm-head">
          <b className="cm-name" dir="auto">{c.author.fullName}</b>
          <span className="tag">{orgTag(c.author)}</span>
          <time className="cm-time num" dateTime={c.createdAt} title={fmtDate(c.createdAt, true)}>{relTime(c.createdAt)}</time>
          {c.editedAt && !c.deleted && <span className="cm-edited" title={"Edited " + fmtDate(c.editedAt, true)}>edited</span>}
          {(c.can.edit || c.can.delete) && !editing && (
            <RowMenu label={`Actions for the comment by ${c.author.fullName}`} items={[
              ...(c.can.edit ? [{ label: "Edit", icon: "edit" as IconName, onClick: () => setEditing(true) }] : []),
              ...(c.can.delete ? [{ label: "Delete", icon: "trash" as IconName, danger: true, onClick: onDelete }] : []),
            ]} />
          )}
        </header>
        {c.deleted ? (
          <p className="cm-gone">This comment was deleted.</p>
        ) : editing ? (
          <CommentEditor c={c} onCancel={() => setEditing(false)}
            onSaved={(s) => { setEditing(false); onSaved(s); toast("Comment updated"); }}
            onGone={() => { setEditing(false); onGone(); }} />
        ) : (
          <div className={"cm-body" + (rtl ? " ar" : "")} dir="auto">{c.body}</div>
        )}
        {!c.deleted && c.attachments.length > 0 && (
          <div className="cm-files">
            {c.attachments.map((a) => <AttachmentChip key={a.id} a={a} onPreview={onPreview} />)}
          </div>
        )}
      </div>
    </article>
  );
}

function CommentEditor({ c, onCancel, onSaved, onGone }: { c: CommentView; onCancel: () => void; onSaved: (c: CommentView) => void; onGone: () => void }) {
  const [text, setText] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, text);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);

  const ready = text.trim().length > 0 && text.trim() !== c.body;
  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.put<CommentView>(`/api/comments/${c.id}`, { body: text }));
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && (e.code === "TICKET_CLOSED" || e.code === "COMMENT_DELETED")) { toast(e.message, "error"); onGone(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cm-edit">
      <label className="sr-only" htmlFor={`cm-edit-${c.id}`}>Edit comment</label>
      <textarea id={`cm-edit-${c.id}`} ref={ref} className={"textarea" + (isArabic(text) ? " ar" : "")} dir="auto" rows={3} maxLength={MAX_COMMENT}
        value={text} disabled={busy} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }} />
      {error && <p className="err" role="alert"><Icon name="alert" size="xs" />{error}</p>}
      <div className="cm-edit-actions">
        <button className="btn ghost sm" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={"btn primary sm" + (busy ? " is-busy" : "")} type="button" onClick={save} disabled={!ready || busy}>{busy && <Spinner />}{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function Composer({ t, onPosted }: { t: TicketDetail; onPosted: (c: CommentView) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staged = useStagedFiles();
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, text);

  const closed = t.status === "CLOSED";
  const locked = closed || !t.canComment;
  const drop = useDropZone(staged.add, locked || busy);
  const ready = text.trim().length > 0 && !busy;

  if (locked) {
    return (
      <div className="composer locked" role="note">
        <Icon name="lock" size="sm" />
        <span>{closed ? `TKT-${t.id} is closed, so new comments and files can't be added.` : "You don't have permission to comment on this ticket."}</span>
      </div>
    );
  }

  async function send() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("body", text);
      staged.files.forEach((f) => fd.append("files", f));
      const saved = await api.upload<CommentView>(`/api/tickets/${t.id}/comments`, fd);
      setText("");
      staged.clear();
      onPosted(saved);
      toast("Comment posted");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    // Text wins when both are on the clipboard (copying a spreadsheet cell puts an image there too).
    if (files.length === 0 || e.clipboardData.getData("text/plain")) return;
    e.preventDefault();
    staged.add(files.map(namePasted));
  }

  return (
    <div className={"composer" + (drop.over ? " is-over" : "")} {...drop.props}>
      <label className="sr-only" htmlFor="cm-new">Write a comment</label>
      <textarea id="cm-new" ref={ref} className={"textarea" + (isArabic(text) ? " ar" : "")} dir="auto" rows={2} maxLength={MAX_COMMENT}
        placeholder="Write a comment…  Paste or drop screenshots to attach them." value={text} disabled={busy}
        onChange={(e) => setText(e.target.value)} onPaste={onPaste}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
      <StagedList files={staged.files} onRemove={staged.remove} disabled={busy} />
      {(error || staged.problem) && <p className="err" role="alert"><Icon name="alert" size="xs" />{error ?? staged.problem}</p>}
      <div className="composer-bar">
        {t.canUpload ? <AttachButton onFiles={staged.add} disabled={busy} /> : <span />}
        <span className="composer-hint">Everyone on the ticket can see comments · Ctrl+Enter to send</span>
        <button className={"btn primary sm" + (busy ? " is-busy" : "")} type="button" onClick={send} disabled={!ready}>{busy && <Spinner />}{busy ? "Posting…" : "Post comment"}</button>
      </div>
      {drop.over && <div className="drop-veil" aria-hidden="true"><Icon name="upload" />Drop files to attach</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ attachments */

export function AttachmentsTab({ t, onChanged, onShowComment }: { t: TicketDetail; onChanged: () => void; onShowComment: (id: number) => void }) {
  const { items, error, reload } = useList<AttachmentView>(`/api/tickets/${t.id}/attachments`, [t.attachmentCount, t.commentCount]);
  const [preview, setPreview] = useState<AttachmentView | null>(null);
  const [deleting, setDeleting] = useState<AttachmentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const closed = t.status === "CLOSED";
  const canUpload = t.canUpload && !closed;

  async function upload(incoming: File[]) {
    if (incoming.length === 0 || uploading) return;
    const staged = checkFiles(incoming, 0);
    setProblem(staged.errors.length ? staged.errors.join(" ") : null);
    if (staged.ok.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      staged.ok.forEach((f) => fd.append("files", f));
      await api.upload(`/api/tickets/${t.id}/attachments`, fd);
      toast(staged.ok.length === 1 ? "File attached" : `${staged.ok.length} files attached`);
      reload();
      onChanged();
    } catch (e) {
      setProblem(message(e));
    } finally {
      setUploading(false);
    }
  }
  const drop = useDropZone(upload, !canUpload || uploading);

  async function remove(a: AttachmentView) {
    setBusy(true);
    try {
      await api.del(`/api/attachments/${a.id}`);
      toast("Attachment removed");
      setDeleting(null);
      reload();
      onChanged();
    } catch (e) {
      toast(message(e), "error");
      if (e instanceof ApiError && (e.code === "TICKET_CLOSED" || e.code === "NOT_FOUND")) { setDeleting(null); reload(); onChanged(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tab-panel att-tab" aria-label="Attachments">
      {canUpload ? (
        <div className={"dropzone" + (drop.over ? " is-over" : "")} {...drop.props}>
          <Icon name="upload" />
          <div className="dropzone-text">
            <b>{uploading ? <><Spinner /> Uploading…</> : "Drop files here to attach them to the ticket"}</b>
            <small>{FILE_HINT}</small>
          </div>
          <AttachButton onFiles={upload} disabled={uploading} label="Choose files" ghost={false} />
        </div>
      ) : (
        <div className="composer locked" role="note">
          <Icon name="lock" size="sm" />
          <span>{closed ? `TKT-${t.id} is closed, so files can't be added or removed.` : "You don't have permission to add files to this ticket."}</span>
        </div>
      )}
      {problem && <p className="err" role="alert" style={{ marginTop: 10 }}><Icon name="alert" size="xs" />{problem}</p>}
      {error && <p className="err" role="alert"><Icon name="alert" size="xs" />{error}</p>}

      {!items && !error && <div style={{ marginTop: 16 }}><RowsSkeleton rows={2} label="Loading attachments" /></div>}
      {items && items.length === 0 && (
        <div className="empty panel" style={{ marginTop: 16 }}>
          <Icon name="clip" />
          <h3>No attachments</h3>
          <p>Screenshots, logs, spreadsheets and SQL scripts added to this ticket show up here.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="att-grid">
          {items.map((a) => (
            <li key={a.id} className="att-card">
              {a.image ? (
                <button type="button" className="att-preview" onClick={() => setPreview(a)} aria-label={`Preview ${a.fileName}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachmentUrl(a.id, true)} alt="" loading="lazy" />
                </button>
              ) : (
                <a className="att-preview is-file" href={attachmentUrl(a.id)} download={a.fileName} aria-label={`Download ${a.fileName}`}>
                  <FileIcon name={a.fileName} />
                </a>
              )}
              <div className="att-meta">
                <span className="att-name" dir="auto" title={a.fileName}>{a.fileName}</span>
                <small className="att-sub"><span className="num">{fmtSize(a.size)}</span> · <span dir="auto">{a.uploadedBy.fullName}</span></small>
                <small className="att-sub"><time className="num" dateTime={a.uploadedAt} title={fmtDate(a.uploadedAt, true)}>{fmtDate(a.uploadedAt)}</time></small>
                <div className="att-foot">
                  {a.purpose === "EVIDENCE" && <span className="tag env-test">Evidence</span>}
                  {a.purpose === "COMMENT" && a.commentId != null && (
                    <button className="tag tag-link" type="button" onClick={() => onShowComment(a.commentId as number)}>On comment</button>
                  )}
                  <span className="att-actions">
                    <a className="icon-btn" href={attachmentUrl(a.id)} download={a.fileName} aria-label={`Download ${a.fileName}`} title="Download"><Icon name="download" size="sm" /></a>
                    {a.can.delete && (
                      <button className="icon-btn danger" type="button" aria-label={`Delete ${a.fileName}`} title="Delete" onClick={() => setDeleting(a)}><Icon name="trash" size="sm" /></button>
                    )}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Lightbox file={preview} onClose={() => setPreview(null)} />
      <Modal open={!!deleting} onClose={() => { if (!busy) setDeleting(null); }} title="Remove this attachment?"
        description={deleting ? <>“<bdi>{deleting.fileName}</bdi>” will disappear from the ticket. The activity log keeps a record that it was removed.</> : undefined}
        footer={<>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button>
          <button className={"btn danger" + (busy ? " is-busy" : "")} type="button" disabled={busy} onClick={() => deleting && remove(deleting)}>{busy && <Spinner />}{busy ? "Removing…" : "Remove"}</button>
        </>}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ small menu */

type MenuItem = { label: string; icon: IconName; danger?: boolean; onClick: () => void };

/** A "..." button with a small menu. Arrow keys move, Escape closes and returns focus. */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); btn.current?.focus(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = els.indexOf(document.activeElement as HTMLElement);
    els[(at + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  }

  return (
    <div className="more-wrap row-menu" ref={wrap} onKeyDown={onKey}>
      <button ref={btn} className="icon-btn" type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="more" size="sm" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={"menu-item" + (it.danger ? " danger" : "")}
              onClick={() => { setOpen(false); it.onClick(); }}>
              <Icon name={it.icon} size="sm" />{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
