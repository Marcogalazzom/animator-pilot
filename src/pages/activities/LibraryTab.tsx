import { useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { Plus, MapPin, Users, Pencil, Trash2 } from 'lucide-react';
import ScheduleTemplateModal from './ScheduleTemplateModal';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';
import { duplicateActivity, deleteActivity, updateActivity } from '@/db/activities';
import type { Activity } from '@/db/types';

interface Props {
  templates: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  onCreateTemplate: () => void;
  onEditTemplate: (t: Activity) => void;
  onRefresh: () => Promise<void>;
}

export default function LibraryTab({ templates, types, search, typeFilter, onCreateTemplate, onEditTemplate, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [scheduling, setScheduling] = useState<Activity | null>(null);
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = templates.filter((t) => {
    if (typeFilter && t.activity_type !== typeFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function schedule(date: string, timeStart: string | null, timeEnd: string | null) {
    if (!scheduling) return;
    const newId = await duplicateActivity(scheduling.id, date);
    // Le duplicate hérite is_template=1 du template source, on le repasse à 0
    // et on applique les heures choisies dans le modal.
    await updateActivity(newId, {
      time_start: timeStart, time_end: timeEnd, is_template: 0,
    } as Partial<Activity>);
    addToast('Activité programmée', 'success');
    await onRefresh();
  }

  async function remove(t: Activity) {
    await deleteActivity(t.id).catch(() => {});
    addToast('Modèle supprimé', 'success');
    await onRefresh();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {filtered.map((t) => {
        const c = typeFor(t.activity_type);
        return (
          <div key={t.id} style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)', padding: '14px',
            borderLeft: `3px solid ${c.color}`, display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '14px' }}>{t.title}</strong>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', color: c.color, background: c.bg, border: `1px solid ${c.color}33`, fontWeight: 500 }}>
                {categoryLabel(c)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
              {t.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} /> {t.location}</span>}
              {t.max_participants > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Users size={11} /> {t.max_participants} max</span>}
            </div>
            {t.materials_needed && (
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>📦 {t.materials_needed}</p>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
              <button onClick={() => setScheduling(t)} style={{ flex: 1, padding: '7px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Programmer</button>
              <button onClick={() => onEditTemplate(t)} style={iconBtn} title="Modifier"><Pencil size={13} /></button>
              <button onClick={() => remove(t)} style={{ ...iconBtn, color: 'var(--color-danger)' }} title="Supprimer"><Trash2 size={13} /></button>
            </div>
          </div>
        );
      })}
      <button onClick={onCreateTemplate} style={{
        background: 'transparent', border: '2px dashed var(--color-border)',
        borderRadius: 'var(--radius-card)', padding: '32px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500,
      }}>
        <Plus size={14} /> Nouveau modèle
      </button>

      {scheduling && (
        <ScheduleTemplateModal
          template={scheduling}
          onSchedule={schedule}
          onClose={() => setScheduling(null)}
        />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--color-bg-soft)', border: 'none', borderRadius: '6px', cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};
