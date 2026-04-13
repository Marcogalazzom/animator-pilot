import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { byDay, type CalendarEvent } from '@/pages/calendar/useCalendarEvents';

interface Props {
  events: CalendarEvent[];
}

const DAY_FR_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTH_FR_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

import { todayIso } from '@/pages/calendar/dateUtils';

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function shortDate(d: Date): string {
  return `${DAY_FR_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_FR_SHORT[d.getMonth()]}`;
}

export default function TodayTimeline({ events }: Props) {
  const today = todayIso();
  const dayEvents = byDay(events, today);
  const now = nowTimeString();

  const [nh, nm] = now.split(':').map(Number);
  const nowMin = nh * 60 + nm;

  // Index du dernier event passé (pour insérer le séparateur "maintenant" après).
  let lastPastIndex = -1;
  for (let i = 0; i < dayEvents.length; i++) {
    const t = dayEvents[i].time;
    if (!t) continue;
    const [h, m] = t.split(':').map(Number);
    const eMin = h * 60 + m;
    if (eMin <= nowMin) lastPastIndex = i;
  }

  // currentId : dernier event passé dans les 30 dernières minutes.
  let currentId: string | null = null;
  if (lastPastIndex >= 0) {
    const t = dayEvents[lastPastIndex].time;
    if (t) {
      const [h, m] = t.split(':').map(Number);
      const eMin = h * 60 + m;
      if (nowMin - eMin <= 30) currentId = dayEvents[lastPastIndex].id;
    }
  }

  const hasFuture = lastPastIndex >= 0 && lastPastIndex < dayEvents.length - 1;
  const showNowDivider = hasFuture; // Affiche le trait "maintenant" si passé+futur coexistent.

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)', padding: '18px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{
            margin: 0, fontSize: '15px', fontWeight: 700,
            fontFamily: 'var(--font-display)',
            display: 'flex', alignItems: 'center', gap: '8px',
            color: 'var(--color-text-primary)',
          }}>
            <CalendarDays size={15} style={{ color: 'var(--color-primary)' }} />
            Aujourd'hui
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            · {shortDate(new Date())}
          </span>
        </div>
        <Link to="/calendar" style={{
          fontSize: '11px', color: 'var(--color-primary)',
          textDecoration: 'none', fontWeight: 500,
        }}>
          Tout voir →
        </Link>
      </div>

      {dayEvents.length === 0 ? (
        <p style={{
          fontSize: '12px', color: 'var(--color-text-secondary)',
          margin: 0, padding: '20px 0', textAlign: 'center',
        }}>
          Pas d'activité aujourd'hui.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {dayEvents.map((e, idx) => {
            const isCurrent = e.id === currentId;
            return (
              <Fragment key={e.id}>
                <div
                  style={{
                    display: 'flex', gap: '12px', padding: '7px 10px',
                    background: isCurrent ? 'var(--color-now-bg)' : 'transparent',
                    borderRadius: '6px', fontSize: '12px', alignItems: 'center',
                    borderLeft: isCurrent ? '3px solid var(--color-now)' : '3px solid transparent',
                  }}
                >
                  <strong style={{
                    width: '44px', textAlign: 'center',
                    color: isCurrent ? 'var(--color-now)' : 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {e.time ?? '—'}
                  </strong>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{e.title}</strong>
                    {e.location && <span style={{ color: 'var(--color-text-secondary)' }}> · {e.location}</span>}
                  </span>
                </div>
                {/* Séparateur "maintenant" entre dernier passé et premier futur */}
                {showNowDivider && idx === lastPastIndex && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 10px',
                  }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--color-now)',
                    }} />
                    <div style={{
                      flex: 1, height: 0,
                      borderTop: '1px dashed var(--color-now)',
                    }} />
                    <span style={{
                      fontSize: '10px', fontWeight: 700,
                      color: 'var(--color-now)', letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>
                      maintenant · {now}
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
