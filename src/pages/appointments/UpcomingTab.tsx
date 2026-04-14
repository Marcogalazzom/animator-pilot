import { useToastStore } from '@/stores/toastStore';
import { Check, Pencil, Trash2, Ban } from 'lucide-react';
import AppointmentCard from './AppointmentCard';
import { bucketize, BUCKETS, type Appointment } from './useAppointmentsData';
import { todayIso } from '@/utils/dateUtils';
import { autoColor, type CategoryColor } from '@/db/categoryColors';
import { markCompleted, markCancelled, deleteAppointment } from '@/db/appointments';

interface Props {
  items: Appointment[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  locationFilter: string;
  onEdit: (a: Appointment) => void;
  onRefresh: () => Promise<void>;
}

export default function UpcomingTab({ items, types, search, typeFilter, locationFilter, onEdit, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const today = todayIso();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'appointments', name, ...autoColor(name), label: null };

  const filtered = items.filter((a) => {
    if (typeFilter && a.appointment_type !== typeFilter) return false;
    if (locationFilter && a.location !== locationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) &&
          !a.participants.toLowerCase().includes(q) &&
          !a.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped = bucketize(filtered, today);

  async function complete(a: Appointment) {
    await markCompleted(a.id).catch(() => {});
    addToast('Rendez-vous terminé', 'success');
    await onRefresh();
  }
  async function cancel(a: Appointment) {
    await markCancelled(a.id).catch(() => {});
    addToast('Rendez-vous annulé', 'success');
    await onRefresh();
  }
  async function remove(a: Appointment) {
    await deleteAppointment(a.id).catch(() => {});
    addToast('Supprimé', 'success');
    await onRefresh();
  }

  if (filtered.length === 0) {
    return <div style={emptyStyle}><p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Aucun rendez-vous à venir.</p></div>;
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
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  type={typeFor(a.appointment_type)}
                  actions={
                    <>
                      <button onClick={() => complete(a)} style={{ ...actionBtn, background: 'var(--color-success)', color: '#fff' }}>
                        <Check size={12} /> Terminer
                      </button>
                      <button onClick={() => onEdit(a)} style={actionBtn}><Pencil size={12} /> Modifier</button>
                      <button onClick={() => cancel(a)} style={actionBtn}><Ban size={12} /> Annuler</button>
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
