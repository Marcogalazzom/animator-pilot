import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { byDay, type CalendarEvent } from '@/pages/calendar/useCalendarEvents';

interface Props {
  events: CalendarEvent[];
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TodayTimeline({ events }: Props) {
  const today = todayIso();
  const dayEvents = byDay(events, today);
  const now = nowTimeString();

  let currentId: string | null = null;
  for (const e of dayEvents) {
    if (e.time && e.time <= now) currentId = e.id;
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CalendarDays size={14} /> Aujourd'hui
        </h3>
        <Link to="/calendar" style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Tout voir →</Link>
      </div>

      {dayEvents.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Pas d'activité aujourd'hui.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {dayEvents.map((e) => {
            const isCurrent = e.id === currentId;
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex', gap: '10px', padding: '6px 8px',
                  background: isCurrent ? '#FEF9EE' : 'transparent',
                  borderRadius: '4px', fontSize: '12px', alignItems: 'center',
                }}
              >
                <strong style={{ width: '40px', color: isCurrent ? '#D97706' : 'var(--color-text-primary)' }}>
                  {isCurrent && '▸ '}{e.time ?? '—'}
                </strong>
                <span style={{ flex: 1 }}>
                  <strong>{e.title}</strong>
                  {e.location && <span style={{ color: 'var(--color-text-secondary)' }}> · {e.location}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
