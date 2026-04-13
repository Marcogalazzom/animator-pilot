import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { upcoming, type CalendarEvent } from '@/pages/calendar/useCalendarEvents';

interface Props {
  events: CalendarEvent[];
}

const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTH_FR_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR_SHORT[d.getMonth()]}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function UpcomingFeed({ events }: Props) {
  const next = upcoming(events, tomorrowIso(), 5);

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} /> Prochaines activités
        </h3>
        <Link to="/calendar?view=list" style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Tout voir →</Link>
      </div>

      {next.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Aucune activité planifiée à venir.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {next.map((e) => (
            <div key={e.id} style={{ fontSize: '12px' }}>
              <strong>{shortDate(e.date)}{e.time && ` · ${e.time}`}</strong>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                {e.title}{e.location && ` · ${e.location}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
