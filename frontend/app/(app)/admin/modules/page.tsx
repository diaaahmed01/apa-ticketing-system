"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ModuleView } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { RowsSkeleton } from "@/components/Skeletons";
import { Spinner } from "@/components/Spinner";
import { toast } from "@/components/Toast";

type Draft = { id?: number; name: string; nameAr: string };

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setModules(await api.get<ModuleView[]>("/api/modules?includeInactive=true"));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load modules.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replace = (m: ModuleView) => setModules((l) => (l ?? []).map((x) => (x.id === m.id ? m : x)));

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const body = { name: draft.name, nameAr: draft.nameAr };
      if (draft.id == null) {
        const m = await api.post<ModuleView>("/api/modules", body);
        setModules((l) => [...(l ?? []), m]);
        toast(`Added ${m.name}`);
      } else {
        replace(await api.put<ModuleView>(`/api/modules/${draft.id}`, body));
        toast("Module saved");
      }
      setDraft(null);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't save the module.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(m: ModuleView) {
    try {
      replace(await api.post<ModuleView>(`/api/modules/${m.id}/${m.active ? "deactivate" : "activate"}`));
      toast(m.active ? `${m.name} hidden from new tickets` : `${m.name} is available again`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't change the module.", "error");
    }
  }

  const active = modules?.filter((m) => m.active).length ?? 0;

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Module Management</h1>
          <p className="sub">
            The module list people pick from when they raise a ticket.
            {modules && <> <b className="num">{active}</b> of <b className="num">{modules.length}</b> in use.</>}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn primary" type="button" onClick={() => { setFormError(null); setDraft({ name: "", nameAr: "" }); }}>
            <Icon name="plus" size="sm" />Add module
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="empty panel"><h3>Modules didn&apos;t load</h3><p>{loadError}</p><button className="btn" type="button" onClick={load}>Try again</button></div>
      ) : !modules ? (
        <RowsSkeleton rows={6} />
      ) : modules.length === 0 ? (
        <div className="empty panel">
          <h3>No modules yet</h3>
          <p>Add the systems tickets are raised against, such as Billing or Gate Operations.</p>
          <button className="btn primary" type="button" onClick={() => setDraft({ name: "", nameAr: "" })}>Add the first module</button>
        </div>
      ) : (
        <ul className="module-list panel">
          {modules.map((m) => (
            <li key={m.id} className={m.active ? undefined : "row-muted"}>
              <span className="module-icon"><Icon name="box" size="sm" /></span>
              <div className="module-names">
                <strong>{m.name}</strong>
                {m.nameAr ? <span className="ar" lang="ar" dir="rtl">{m.nameAr}</span> : <span className="missing">No Arabic name</span>}
              </div>
              <span className={"status " + (m.active ? "s-closed" : "s-cancelled")}>{m.active ? "Active" : "Inactive"}</span>
              <div className="row-actions">
                <button className="btn ghost sm" type="button" onClick={() => { setFormError(null); setDraft({ id: m.id, name: m.name, nameAr: m.nameAr ?? "" }); }}>
                  <Icon name="edit" size="sm" />Edit
                </button>
                <label className="switch" title={m.active ? "Deactivate" : "Activate"}>
                  <input type="checkbox" checked={m.active} onChange={() => toggle(m)} aria-label={(m.active ? "Deactivate " : "Activate ") + m.name} />
                  <span />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="footnote"><Icon name="info" size="xs" /> Inactive modules disappear from the new-ticket form but stay on tickets that already use them.</p>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id == null ? "Add module" : "Edit module"}
        footer={<>
          <button className="btn ghost" type="button" onClick={() => setDraft(null)}>Cancel</button>
          <button className={"btn primary" + (saving ? " is-busy" : "")} type="button" onClick={save} disabled={saving || !draft?.name.trim()}>
            {saving && <Spinner />}{saving ? "Saving…" : draft?.id == null ? "Add module" : "Save changes"}
          </button>
        </>}
      >
        {draft && (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="m-name">Name (English)</label>
              <input id="m-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="m-ar">Name (Arabic) <span className="opt">optional</span></label>
              <input id="m-ar" className="input ar" lang="ar" dir="rtl" value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} maxLength={80} />
            </div>
            {formError && <p className="err span-2" role="alert">{formError}</p>}
          </div>
        )}
      </Modal>
    </main>
  );
}
