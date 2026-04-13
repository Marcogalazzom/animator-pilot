import { useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import ActivityCard from './ActivityCard';
import { splitPast, type Activity } from './useActivitiesData';
import { todayIso } from '@/utils/dateUtils';
import { autoColor, type CategoryColor } from '@/db/categoryColors';
import { markCompleted, markCancelled, saveAsTemplate, updateActivity } from '@/db/activities';

interface Props {
  items: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  locationFilter: string;
  onRefresh: () => Promise<void>;
}

export default function PastTab({ items, types, search, typeFilter, locationFilter, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [showCancelled, setShowCancelled] = useState(false);
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

  const { toConfirm, completed, cancelled } = splitPast(filtered, today);

  async function close(a: Activity) {
    const n = parseInt(presents[a.id] ?? String(a.actual_participants)) || 0;
    await markCompleted(a.id, n).catch(() => {});
    addToast('Clôturée', 'success');
    await onRefresh();
  }
  async function cancel(a: Activity) {
    await markCancelled(a.id).catch(() => {});
    addToast('Annulée', 'success');
    await onRefresh();
  }
  async function template(a: Activity) {
    await saveAsTemplate(a.id).catch(() => {});
    addToast('Modèle enregistré', 'success');
    await onRefresh();
  }
  async function reopen(a: Activity) {
    await updateActivity(a.id, { status: 'planned', actual_participants: 0 }).catch(() => {});
    addToast('Activité ré-ouverte', 'success');
    await onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toConfirm.length > 0 && (
        <div>
          <div style={{ ...sectionHeader, color: 'var(--color-now)' }}>
            ⚠ À confirmer <span style={{ opacity: 0.7 }}>· {toConfirm.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {toConfirm.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                type={typeFor(a.activity_type)}
                inlineRow={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '10px', background: 'var(--color-now-bg)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Présents :</span>
                    <input
                      type="number" min="0" max={a.max_participants}
                      value={presents[a.id] ?? ''}
                      placeholder={String(a.actual_participants || 0)}
                      onChange={(e) => setPresents((p) => ({ ...p, [a.id]: e.target.value }))}
                      style={{ width: '60px', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>/ {a.max_participants}</span>
                    <button onClick={() => close(a)} style={{ marginLeft: 'auto', padding: '5px 12px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✓ Clôturer</button>
                    <button onClick={() => cancel(a)} style={{ padding: '5px 12px', background: '#FEF2F2', color: 'var(--color-danger)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Annuler</button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div style={{ ...sectionHeader, color: 'var(--color-success)' }}>
            ✓ Terminées <span style={{ opacity: 0.7 }}>· {completed.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completed.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                type={typeFor(a.activity_type)}
                inlineRow={a.notes ? (
                  <p style={{ margin: '8px 0 0', fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>"{a.notes}"</p>
                ) : null}
                actions={
                  <>
                    <button onClick={() => reopen(a)} style={actionBtn}><Undo2 size={11} /> Ré-ouvrir</button>
                    <button onClick={() => template(a)} style={actionBtn}>+ Modèle</button>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {cancelled.length > 0 && (
        <div>
          <button onClick={() => setShowCancelled((v) => !v)} style={{ ...sectionHeader, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {showCancelled ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Annulées <span style={{ opacity: 0.7 }}>· {cancelled.length}</span>
          </button>
          {showCancelled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {cancelled.map((a) => (
                <ActivityCard key={a.id} activity={a} type={typeFor(a.activity_type)} />
              ))}
            </div>
          )}
        </div>
      )}

      {toConfirm.length === 0 && completed.length === 0 && cancelled.length === 0 && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '40px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Aucune activité passée.</p>
        </div>
      )}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '8px',
};
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '5px 10px', fontSize: '11px', fontWeight: 500,
  background: 'var(--color-bg-soft)', color: 'var(--color-text-primary)',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
};
