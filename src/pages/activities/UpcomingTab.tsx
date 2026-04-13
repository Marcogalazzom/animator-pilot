import { useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { Check, Copy, Pencil, Trash2 } from 'lucide-react';
import ActivityCard from './ActivityCard';
import { bucketize, BUCKETS, type Activity } from './useActivitiesData';
import { todayIso } from '@/utils/dateUtils';
import { autoColor, type CategoryColor } from '@/db/categoryColors';
import { markCompleted, deleteActivity, duplicateActivity } from '@/db/activities';

interface Props {
  items: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  locationFilter: string;
  onEdit: (a: Activity) => void;
  onRefresh: () => Promise<void>;
}

export default function UpcomingTab({ items, types, search, typeFilter, locationFilter, onEdit, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [presents, setPresents] = useState<Record<number, string>>({});
  const today = todayIso();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = items.filter((a) => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (locationFilter && a.location !== locationFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = bucketize(filtered, today);

  async function complete(a: Activity) {
    const raw = presents[a.id];
    const n = raw !== undefined ? (parseInt(raw) || 0) : a.actual_participants;
    await markCompleted(a.id, n).catch(() => {});
    addToast(`Activité clôturée — ${n} présent${n > 1 ? 's' : ''}`, 'success');
    await onRefresh();
  }
  async function duplicate(a: Activity) {
    await duplicateActivity(a.id, today).catch(() => {});
    addToast('Activité dupliquée', 'success');
    await onRefresh();
  }
  async function remove(a: Activity) {
    await deleteActivity(a.id).catch(() => {});
    addToast('Supprimée', 'success');
    await onRefresh();
  }

  if (filtered.length === 0) {
    return <div style={emptyStyle}><p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Aucune activité à venir.</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {BUCKETS.map((b) => {
        const list = grouped[b];
        if (list.length === 0) return null;
        return (
          <div key={b}>
            <div style={sectionHeader}>{b} <span style={{ opacity: 0.6 }}>· {list.length}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {list.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  type={typeFor(a.activity_type)}
                  inlineRow={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '8px 10px', background: 'var(--color-bg-soft)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Présents :</span>
                      <input
                        type="number" min="0" max={a.max_participants || undefined}
                        value={presents[a.id] ?? ''}
                        placeholder={String(a.actual_participants || 0)}
                        onChange={(e) => setPresents((p) => ({ ...p, [a.id]: e.target.value }))}
                        style={{ width: '56px', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }}
                      />
                      {a.max_participants > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>/ {a.max_participants}</span>
                      )}
                      <button onClick={() => complete(a)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        <Check size={12} /> Terminer
                      </button>
                    </div>
                  }
                  actions={
                    <>
                      <button onClick={() => duplicate(a)} style={actionBtn}><Copy size={12} /> Dupliquer</button>
                      <button onClick={() => onEdit(a)} style={actionBtn}><Pencil size={12} /> Modifier</button>
                      <button onClick={() => remove(a)} style={{ ...actionBtn, color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                    </>
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
};
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '5px 10px', fontSize: '11px', fontWeight: 500,
  background: 'var(--color-bg-soft)', color: 'var(--color-text-primary)',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
};
const emptyStyle: React.CSSProperties = {
  background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)', padding: '40px', textAlign: 'center',
};
