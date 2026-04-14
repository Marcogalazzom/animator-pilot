import { useRef } from 'react';
import { X } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { Appointment, AppointmentStatus } from '@/db/types';

const STATUS_META: Record<AppointmentStatus, { label: string }> = {
  planned:   { label: 'Planifié' },
  completed: { label: 'Terminé' },
  cancelled: { label: 'Annulé' },
};

interface Props {
  initial: Appointment | null;
  types: CategoryColor[];
  onSubmit: (data: Omit<Appointment, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}

export default function AppointmentFormModal({ initial, types, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current; if (!form) return;
    const fd = new FormData(form);
    const data = {
      title: fd.get('title') as string,
      appointment_type: (fd.get('appointment_type') as string) || 'meeting',
      date: fd.get('date') as string,
      time_start: (fd.get('time_start') as string) || null,
      time_end: (fd.get('time_end') as string) || null,
      location: (fd.get('location') as string) || '',
      participants: (fd.get('participants') as string) || '',
      description: (fd.get('description') as string) || '',
      status: ((fd.get('status') as AppointmentStatus) || 'planned'),
    } satisfies Omit<Appointment, 'id' | 'created_at'>;
    await onSubmit(data);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
            {initial ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Titre
            <input name="title" defaultValue={initial?.title ?? ''} required style={inputStyle} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Type
              <input name="appointment_type" list="appointment-types" defaultValue={initial?.appointment_type ?? 'meeting'} placeholder="Tapez ou choisissez…" style={inputStyle} />
              <datalist id="appointment-types">
                {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
              </datalist>
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Statut
              <select name="status" defaultValue={initial?.status ?? 'planned'} style={inputStyle}>
                {(Object.keys(STATUS_META) as AppointmentStatus[]).map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
              </select>
            </label>
          </div>

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

          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Lieu
            <input name="location" defaultValue={initial?.location ?? ''} placeholder="Bureau, salle 2, visio…" style={inputStyle} />
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Participants
            <input name="participants" defaultValue={initial?.participants ?? ''} placeholder="Ex : Marie (CHSLD), équipe animation…" style={inputStyle} />
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Description / ordre du jour
            <textarea name="description" rows={3} defaultValue={initial?.description ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>

          <button type="submit" style={{ padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
            {initial ? 'Mettre à jour' : 'Créer le rendez-vous'}
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
