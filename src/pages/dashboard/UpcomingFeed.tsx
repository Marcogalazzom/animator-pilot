import { Link } from 'react-router-dom';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';
import { upcoming, type CalendarEvent } from '@/pages/calendar/useCalendarEvents';

interface Props {
  events: CalendarEvent[];
}

const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTH_FR_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isoToLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return 'Demain';
  if (diffDays < 7) return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR_SHORT[d.getMonth()]}`;
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR_SHORT[d.getMonth()]}`;
}

export default function UpcomingFeed({ events }: Props) {
  const next = upcoming(events, tomorrowIso(), 5);

  // Groupe par date
  const groupedMap = new Map<string, CalendarEvent[]>();
  for (const e of next) {
    const list = groupedMap.get(e.date) ?? [];
    list.push(e);
    groupedMap.set(e.date, list);
  }
  const groups = Array.from(groupedMap.entries());

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)', padding: '18px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <h3 style={{
          margin: 0, fontSize: '15px', fontWeight: 700,
          fontFamily: 'var(--font-display)',
          display: 'flex', alignItems: 'center', gap: '8px',
          color: 'var(--color-text-primary)',
        }}>
          <Clock size={15} style={{ color: 'var(--color-primary)' }} />
          Prochaines activités
        </h3>
        <Link to="/calendar?view=list" style={{
          fontSize: '11px', color: 'var(--color-primary)',
          textDecoration: 'none', fontWeight: 500,
        }}>
          Tout voir →
        </Link>
      </div>

      {next.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          padding: '28px 0',
        }}>
          <CalendarIcon size={32} style={{ color: 'var(--color-border)' }} />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Aucune activité planifiée à venir.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map(([date, list]) => (
            <div key={date}>
              <div style={{
                fontSize: '11px', fontWeight: 700,
                color: 'var(--color-primary)', letterSpacing: '0.03em',
                textTransform: 'uppercase', marginBottom: '6px',
              }}>
                {isoToLabel(date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {list.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', gap: '10px', alignItems: 'center',
                      padding: '6px 8px', borderRadius: '6px',
                    }}
                  >
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px',
                      background: 'var(--color-bg-soft)',
                      fontSize: '11px', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--color-text-primary)',
                      minWidth: '50px', textAlign: 'center',
                    }}>
                      {e.time ?? '—'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '12px' }}>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{e.title}</strong>
                      {e.location && (
                        <span style={{ color: 'var(--color-text-secondary)' }}> · {e.location}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
