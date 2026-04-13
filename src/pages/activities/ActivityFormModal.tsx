import { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { Activity, ActivityStatus } from '@/db/types';

const STATUS_META: Record<ActivityStatus, { label: string }> = {
  planned: { label: 'Planifié' }, in_progress: { label: 'En cours' },
  completed: { label: 'Terminé' }, cancelled: { label: 'Annulé' },
};

interface Props {
  initial: Activity | null;
  defaultMode?: 'scheduled' | 'template';
  types: CategoryColor[];
  onSubmit: (data: Omit<Activity, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}

export default function ActivityFormModal({ initial, defaultMode = 'scheduled', types, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isTemplate, setIsTemplate] = useState((initial?.is_template === 1) || defaultMode === 'template');

  useEffect(() => {
    setIsTemplate((initial?.is_template === 1) || defaultMode === 'template');
  }, [initial, defaultMode]);

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
      synced_from: '',
      last_sync_at: null,
      external_id: null,
    } satisfies Omit<Activity, 'id' | 'created_at'>;
    await onSubmit(data);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
            {initial ? (isTemplate ? 'Modifier le modèle' : "Modifier l'activité") : (isTemplate ? 'Nouveau modèle' : 'Nouvelle activité')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-soft)', marginBottom: '14px', fontSize: '13px', cursor: 'pointer' }}>
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
          📋 Modèle <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>(activité réutilisable, sans date ni heure)</span>
        </label>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Titre
            <input name="title" defaultValue={initial?.title ?? ''} required style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Type
              <input name="activity_type" list="activity-types" defaultValue={initial?.activity_type ?? 'jeux'} placeholder="Tapez ou choisissez…" style={inputStyle} />
              <datalist id="activity-types">
                {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
              </datalist>
            </label>
            {!isTemplate && (
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Statut
                <select name="status" defaultValue={initial?.status ?? 'planned'} style={inputStyle}>
                  {(Object.keys(STATUS_META) as ActivityStatus[]).map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
                </select>
              </label>
            )}
          </div>
          {!isTemplate && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Date
                <input name="date" type="date" defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)} required style={inputStyle} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Début
                <input name="time_start" type="time" defaultValue={initial?.time_start ?? ''} style={inputStyle} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Fin
                <input name="time_end" type="time" defaultValue={initial?.time_end ?? ''} style={inputStyle} />
              </label>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isTemplate ? '2fr 1fr' : '2fr 1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Lieu
              <input name="location" defaultValue={initial?.location ?? ''} style={inputStyle} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Max. part.
              <input name="max_participants" type="number" min="0" defaultValue={initial?.max_participants ?? 15} style={inputStyle} />
            </label>
            {!isTemplate && (
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Présents
                <input name="actual_participants" type="number" min="0" defaultValue={initial?.actual_participants ?? 0} style={inputStyle} />
              </label>
            )}
          </div>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Animateur/trice
            <input name="animator_name" defaultValue={initial?.animator_name ?? ''} style={inputStyle} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Description
            <textarea name="description" rows={2} defaultValue={initial?.description ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Matériel nécessaire
            <input name="materials_needed" defaultValue={initial?.materials_needed ?? ''} placeholder="Pinceaux, papier, enceinte…" style={inputStyle} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Notes
            <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          {!isTemplate && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', fontSize: '13px', fontWeight: 500 }}>
              <input name="is_shared" type="checkbox" defaultChecked={initial ? initial.is_shared === 1 : true} />
              <span>Activité partagée <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>— visible sur planning-ehpad. Décochez pour les RDV perso.</span></span>
            </label>
          )}
          <button type="submit" style={{ padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
            {initial ? 'Mettre à jour' : (isTemplate ? 'Créer le modèle' : "Créer l'activité")}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', marginTop: '4px',
  border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px',
};
