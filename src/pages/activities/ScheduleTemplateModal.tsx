import { useState } from 'react';
import { X } from 'lucide-react';
import { todayIso } from '@/utils/dateUtils';
import type { Activity } from '@/db/types';

interface Props {
  template: Activity;
  onSchedule: (date: string, timeStart: string | null, timeEnd: string | null) => Promise<void>;
  onClose: () => void;
}

export default function ScheduleTemplateModal({ template, onSchedule, onClose }: Props) {
  const [date, setDate] = useState(todayIso());
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSchedule(date, timeStart || null, timeEnd || null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>
            Programmer "{template.title}"
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Début
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Fin
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <button type="submit" disabled={busy} style={{ padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', marginTop: '4px' }}>
            {busy ? 'Création…' : 'Programmer'}
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
