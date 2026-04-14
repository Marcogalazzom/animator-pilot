import { useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { ChevronDown, ChevronRight, Undo2, Pencil, Trash2 } from 'lucide-react';
import AppointmentCard from './AppointmentCard';
import { splitPast, type Appointment } from './useAppointmentsData';
import { todayIso } from '@/utils/dateUtils';
import { autoColor, type CategoryColor } from '@/db/categoryColors';
import { markCompleted, markCancelled, reopen, deleteAppointment } from '@/db/appointments';

interface Props {
  items: Appointment[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  locationFilter: string;
  onEdit: (a: Appointment) => void;
  onRefresh: () => Promise<void>;
}

export default function PastTab({ items, types, search, typeFilter, locationFilter, onEdit, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [showCancelled, setShowCancelled] = useState(false);
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

  const { toConfirm, completed, cancelled } = splitPast(filtered, today);

  async function close(a: Appointment) {
    await markCompleted(a.id).catch(() => {});
    addToast('Terminé', 'success');
    await onRefresh();
  }
  async function cancel(a: Appointment) {
    await markCancelled(a.id).catch(() => {});
    addToast('Annulé', 'success');
    await onRefresh();
  }
  async function reopenOne(a: Appointment) {
    await reopen(a.id).catch(() => {});
    addToast('Rendez-vous ré-ouvert', 'success');
    await onRefresh();
  }
  async function remove(a: Appointment) {
    await deleteAppointment(a.id).catch(() => {});
    addToast('Supprimé', 'success');
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
              <AppointmentCard
                key={a.id}
                appointment={a}
                type={typeFor(a.appointment_type)}
                inlineRow={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '10px', background: 'var(--color-now-bg)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Ce rendez-vous est passé — mettre à jour le statut :</span>
                    <button onClick={() => close(a)} style={{ marginLeft: 'auto', padding: '5px 12px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✓ Terminer</button>
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
            ✓ Terminés <span style={{ opacity: 0.7 }}>· {completed.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completed.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                type={typeFor(a.appointment_type)}
                actions={
                  <>
                    <button onClick={() => reopenOne(a)} style={actionBtn}><Undo2 size={11} /> Ré-ouvrir</button>
                    <button onClick={() => onEdit(a)} style={actionBtn}><Pencil size={11} /> Modifier</button>
                    <button onClick={() => remove(a)} style={{ ...actionBtn, color: 'var(--color-danger)' }}><Trash2 size={11} /></button>
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
            Annulés <span style={{ opacity: 0.7 }}>· {cancelled.length}</span>
          </button>
          {showCancelled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {cancelled.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  type={typeFor(a.appointment_type)}
                  actions={
                    <>
                      <button onClick={() => reopenOne(a)} style={actionBtn}><Undo2 size={11} /> Ré-ouvrir</button>
                      <button onClick={() => remove(a)} style={{ ...actionBtn, color: 'var(--color-danger)' }}><Trash2 size={11} /></button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {toConfirm.length === 0 && completed.length === 0 && cancelled.length === 0 && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '40px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Aucun rendez-vous passé.</p>
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
