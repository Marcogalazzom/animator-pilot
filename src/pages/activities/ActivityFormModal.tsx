import { useRef, useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { Activity, ActivityStatus, ActivityUnit, ActivityCategory, ActivityDifficulty } from '@/db/types';
import { useActivityViewMode } from '@/hooks/useActivityViewMode';

const STATUS_META: Record<ActivityStatus, { label: string }> = {
  planned: { label: 'Planifié' }, in_progress: { label: 'En cours' },
  completed: { label: 'Terminé' }, cancelled: { label: 'Annulé' },
};

const CATEGORY_OPTIONS: Array<{ value: ActivityCategory; label: string }> = [
  { value: 'memory',   label: 'Mémoire' },
  { value: 'body',     label: 'Physique' },
  { value: 'creative', label: 'Créatif' },
  { value: 'outing',   label: 'Social' },
  { value: 'rdv',      label: 'Sensoriel' },
  { value: 'prep',     label: 'Spectacles' },
];

const DIFFICULTY_OPTIONS: Array<{ value: ActivityDifficulty; label: string; chip: string }> = [
  { value: 'facile',    label: 'Facile',    chip: 'done' },
  { value: 'moyen',     label: 'Moyen',     chip: 'warn' },
  { value: 'difficile', label: 'Difficile', chip: 'danger' },
];

interface Props {
  initial: Activity | null;
  defaultMode?: 'scheduled' | 'template';
  types: CategoryColor[];
  onSubmit: (data: Omit<Activity, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}

export default function ActivityFormModal({ initial, defaultMode = 'scheduled', types, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [viewMode] = useActivityViewMode();
  const [isTemplate, setIsTemplate] = useState((initial?.is_template === 1) || defaultMode === 'template');
  const [unit, setUnit] = useState<ActivityUnit>(
    initial?.unit ?? (viewMode === 'pasa' ? 'pasa' : 'main'),
  );
  const [category, setCategory] = useState<ActivityCategory>(initial?.category ?? 'prep');
  const [difficulty, setDifficulty] = useState<ActivityDifficulty>(initial?.difficulty ?? 'facile');
  // Default: expand on edit (so user sees current values), collapse on create.
  const [showMore, setShowMore] = useState<boolean>(initial !== null);

  useEffect(() => {
    setIsTemplate((initial?.is_template === 1) || defaultMode === 'template');
  }, [initial, defaultMode]);

  useEffect(() => {
    setUnit(initial?.unit ?? (viewMode === 'pasa' ? 'pasa' : 'main'));
    setCategory(initial?.category ?? 'prep');
    setDifficulty(initial?.difficulty ?? 'facile');
  }, [initial, viewMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current; if (!form) return;
    const fd = new FormData(form);
    const data = {
      title: fd.get('title') as string,
      activity_type: (fd.get('activity_type') as string) || 'jeux',
      description: (fd.get('description') as string) || '',
      date: isTemplate ? '' : (fd.get('date') as string),
      time_start: isTemplate ? null : ((fd.get('time_start') as string) || null),
      time_end: isTemplate ? null : ((fd.get('time_end') as string) || null),
      location: (fd.get('location') as string) || '',
      max_participants: parseInt(fd.get('max_participants') as string) || 0,
      actual_participants: isTemplate ? 0 : (parseInt(fd.get('actual_participants') as string) || 0),
      animator_name: (fd.get('animator_name') as string) || '',
      status: isTemplate ? ('planned' as ActivityStatus) : ((fd.get('status') as ActivityStatus) || 'planned'),
      materials_needed: (fd.get('materials_needed') as string) || '',
      notes: (fd.get('notes') as string) || '',
      linked_project_id: null,
      is_shared: fd.get('is_shared') === 'on' ? 1 : 0,
      is_template: isTemplate ? 1 : 0,
      unit,
      is_recurring: initial?.is_recurring ?? 0,
      category,
      difficulty,
      synced_from: '',
      last_sync_at: null,
      external_id: null,
    } satisfies Omit<Activity, 'id' | 'created_at'>;
    await onSubmit(data);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(35, 29, 24, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          padding: 24,
          width: showMore ? 680 : 540,
          maxWidth: '100%',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          transition: 'width 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>
            {initial ? (isTemplate ? 'Modifier le modèle' : "Modifier l'activité") : (isTemplate ? 'Nouveau modèle' : 'Nouvelle activité')}
          </h2>
          <div style={{ flex: 1 }} />
          <button
            className="btn ghost"
            onClick={onClose}
            style={{ padding: 6 }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 10,
          background: 'var(--surface-2)', marginBottom: 10,
          fontSize: 13, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
          Modèle <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>(activité réutilisable, sans date ni heure)</span>
        </label>

        <div style={{
          display: 'flex', gap: 6, padding: 4,
          borderRadius: 999,
          background: 'var(--surface-2)', marginBottom: 14,
        }}>
          {(['main', 'pasa'] as ActivityUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              style={{
                flex: 1, padding: 7, border: 'none', borderRadius: 999, cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: unit === u ? 'var(--surface)' : 'transparent',
                color: unit === u ? 'var(--terra-deep)' : 'var(--ink-3)',
                boxShadow: unit === u ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {u === 'main' ? 'Animation' : 'PASA'}
            </button>
          ))}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ─── Simple fields (always shown) ─── */}
          <Field label="Titre" required>
            <input name="title" defaultValue={initial?.title ?? ''} required style={inputStyle} />
          </Field>

          {!isTemplate && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Date">
                <input name="date" type="date" defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)} required style={inputStyle} />
              </Field>
              <Field label="Début">
                <input name="time_start" type="time" defaultValue={initial?.time_start ?? ''} style={inputStyle} />
              </Field>
              <Field label="Fin">
                <input name="time_end" type="time" defaultValue={initial?.time_end ?? ''} style={inputStyle} />
              </Field>
            </div>
          )}

          <Field label="Catégorie">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {CATEGORY_OPTIONS.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={active ? `chip ${c.value}` : 'chip ghost'}
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: isTemplate ? '2fr 1fr' : '2fr 1fr 1fr', gap: 12 }}>
            <Field label="Lieu">
              <input name="location" defaultValue={initial?.location ?? ''} style={inputStyle} />
            </Field>
            <Field label="Max. part.">
              <input name="max_participants" type="number" min="0" defaultValue={initial?.max_participants ?? 15} style={inputStyle} />
            </Field>
            {!isTemplate && (
              <Field label="Présents">
                <input name="actual_participants" type="number" min="0" defaultValue={initial?.actual_participants ?? 0} style={inputStyle} />
              </Field>
            )}
          </div>

          {/* ─── More options toggle ─── */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="btn ghost sm"
            style={{ alignSelf: 'flex-start' }}
          >
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showMore ? 'Moins d\'options' : "Plus d'options"}
          </button>

          {showMore && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Type (libre)">
                  <input
                    name="activity_type" list="activity-types"
                    defaultValue={initial?.activity_type ?? 'jeux'}
                    placeholder="Tapez ou choisissez…"
                    style={inputStyle}
                  />
                  <datalist id="activity-types">
                    {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
                  </datalist>
                </Field>
                {!isTemplate && (
                  <Field label="Statut">
                    <select name="status" defaultValue={initial?.status ?? 'planned'} style={inputStyle}>
                      {(Object.keys(STATUS_META) as ActivityStatus[]).map((k) => (
                        <option key={k} value={k}>{STATUS_META[k].label}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <Field label="Difficulté">
                <div style={{
                  display: 'flex', gap: 6, padding: 4, marginTop: 4,
                  borderRadius: 999, background: 'var(--surface-2)',
                }}>
                  {DIFFICULTY_OPTIONS.map((d) => {
                    const active = difficulty === d.value;
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDifficulty(d.value)}
                        style={{
                          flex: 1, padding: 7, border: 'none', borderRadius: 999, cursor: 'pointer',
                          fontSize: 12, fontWeight: active ? 600 : 500,
                          background: active ? 'var(--surface)' : 'transparent',
                          color: active ? 'var(--terra-deep)' : 'var(--ink-3)',
                          boxShadow: active ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Animateur/trice">
                <input name="animator_name" defaultValue={initial?.animator_name ?? ''} style={inputStyle} />
              </Field>

              <Field label="Description">
                <textarea name="description" rows={2} defaultValue={initial?.description ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>

              <Field label="Matériel nécessaire">
                <input name="materials_needed" defaultValue={initial?.materials_needed ?? ''} placeholder="Pinceaux, papier, enceinte…" style={inputStyle} />
              </Field>

              <Field label="Notes">
                <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>

              {!isTemplate && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--cat-rdv-bg)',
                  border: '1px solid var(--cat-rdv-bg)',
                  fontSize: 13, fontWeight: 500, color: 'var(--cat-rdv)',
                }}>
                  <input name="is_shared" type="checkbox" defaultChecked={initial ? initial.is_shared === 1 : true} />
                  <span>Activité partagée <span style={{ fontWeight: 400, opacity: 0.85 }}>— visible sur planning-ehpad. Décochez pour les RDV perso.</span></span>
                </label>
              )}
            </>
          )}

          <button type="submit" className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }}>
            {initial ? 'Mettre à jour' : (isTemplate ? 'Créer le modèle' : "Créer l'activité")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--line)', borderRadius: 8, fontSize: 13,
  background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
  fontFamily: 'inherit',
};
