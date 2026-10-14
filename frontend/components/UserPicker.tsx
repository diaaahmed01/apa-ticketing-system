"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar, Icon } from "./Icon";
import type { DirectoryEntry } from "@/lib/tickets";

const ORG = (o: string) => (o === "VENDOR" ? "HQ" : "Port");
const ROLE_NAME: Record<string, string> = {
  APP_SUPPORT: "Application Support", APP_MANAGER: "Application Manager", DEVELOPER: "Developer",
  TESTER: "Tester", INTEGRATION: "Integration", SYS_ADMIN: "System Administrator",
};

/**
 * Searchable person picker. Single mode returns one id (or null); multi mode a list.
 * `prefer` floats people holding those roles to the top (e.g. Developers for reviewer)
 * without hiding anyone. `exclude` removes people who can't be chosen, with a reason.
 */
export function UserPicker(props: {
  id?: string;
  people: DirectoryEntry[];
  placeholder?: string;
  prefer?: string[];
  exclude?: Map<number, string>;
  disabled?: boolean;
} & ({ multi?: false; value: number | null; onChange: (v: number | null) => void }
   | { multi: true; value: number[]; onChange: (v: number[]) => void })) {
  const { people, placeholder = "Choose a person", prefer = [], exclude, disabled } = props;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected: number[] = props.multi ? props.value : props.value == null ? [] : [props.value];
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const score = (p: DirectoryEntry) => (p.roles.some((r) => prefer.includes(r)) ? 0 : 1);
    return people
      .filter((p) => !needle || p.fullName.toLowerCase().includes(needle) || p.roles.some((r) => (ROLE_NAME[r] ?? r).toLowerCase().includes(needle)))
      .filter((p) => !(props.multi && selected.includes(p.id)))
      .sort((a, b) => score(a) - score(b) || a.fullName.localeCompare(b.fullName));
  }, [people, q, prefer, props.multi, selected]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => { setActive(0); }, [q, open]);

  function choose(p: DirectoryEntry) {
    if (exclude?.has(p.id)) return;
    if (props.multi) props.onChange([...props.value, p.id]);
    else { props.onChange(p.id); setOpen(false); }
    setQ("");
    input.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open && options[active]) { e.preventDefault(); choose(options[active]); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Backspace" && !q && props.multi && props.value.length) props.onChange(props.value.slice(0, -1));
  }

  const single = !props.multi && props.value != null ? byId.get(props.value) : null;

  return (
    <div className={"picker" + (open ? " open" : "") + (disabled ? " disabled" : "")} ref={wrap}>
      <div className="picker-box" onClick={() => { if (!disabled) { setOpen(true); input.current?.focus(); } }}>
        {props.multi && props.value.map((id) => {
          const p = byId.get(id);
          return (
            <span key={id} className="picker-chip">
              <Avatar name={p?.fullName ?? "?"} color={p?.avatarColor} size="xs" />
              <span dir="auto">{p?.fullName ?? "Unknown"}</span>
              {!disabled && (
                <button type="button" aria-label={`Remove ${p?.fullName}`} onClick={(e) => { e.stopPropagation(); props.onChange(props.value.filter((x) => x !== id)); }}>
                  <Icon name="x" size="xs" />
                </button>
              )}
            </span>
          );
        })}
        {single && !open ? (
          <span className="picker-single">
            <Avatar name={single.fullName} color={single.avatarColor} size="xs" />
            <span dir="auto">{single.fullName}</span>
            <small>{ORG(single.organization)}</small>
          </span>
        ) : null}
        <input
          ref={input}
          id={props.id}
          className="picker-input"
          style={single && !open ? { position: "absolute", opacity: 0, pointerEvents: "none" } : undefined}
          value={q}
          disabled={disabled}
          placeholder={props.multi && props.value.length ? "" : single ? "" : placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {!props.multi && props.value != null && !disabled && (
          <button type="button" className="picker-clear" aria-label="Clear" onClick={(e) => { e.stopPropagation(); props.onChange(null); }}>
            <Icon name="x" size="xs" />
          </button>
        )}
        <Icon name="chevDown" size="xs" className="picker-caret" />
      </div>
      {open && !disabled && (
        <ul className="picker-list" id={listId} role="listbox">
          {options.length === 0 && <li className="picker-empty">No one matches “{q}”</li>}
          {options.map((p, i) => {
            const blocked = exclude?.get(p.id);
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={selected.includes(p.id)}
                aria-disabled={!!blocked}
                className={(i === active ? "active " : "") + (blocked ? "blocked" : "")}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                title={blocked}
              >
                <Avatar name={p.fullName} color={p.avatarColor} size="xs" />
                <span className="po-name" dir="auto">{p.fullName}</span>
                <span className="po-meta">{blocked ?? p.roles.map((r) => ROLE_NAME[r] ?? r).join(", ")}</span>
                <span className="po-org">{ORG(p.organization)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
