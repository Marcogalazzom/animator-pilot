import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { getUpcomingPlanned } from '@/db/appointments';
import type { Appointment } from '@/db/types';

const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTH_FR_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function isoToLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR_SHORT[d.getMonth()]}`;
}

const APPT_COLOR = '#7C3AED';
const APPT_BG = '#F3EEFF';

export default function UpcomingAppointments() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getUpcomingPlanned()
      .then((rows) => { if (!cancelled) setItems(rows.slice(0, 5)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Groupe par date
  const groupedMap = new Map<string, Appointment[]>();
  for (const a of items) {
    const list = groupedMap.get(a.date) ?? [];
    list.push(a);
    groupedMap.set(a.date, list);
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
          <CalendarClock size={15} style={{ color: APPT_COLOR }} />
          Prochains rendez-vous
        </h3>
        <Link to="/appointments" style={{
          fontSize: '11px', color: APPT_COLOR,
          textDecoration: 'none', fontWeight: 500,
        }}>
          Tout voir →
        </Link>
      </div>

      {loading ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          padding: '28px 0',
        }}>
          <CalendarClock size={32} style={{ color: 'var(--color-border)' }} />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Aucun rendez-vous planifié.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map(([date, list]) => (
            <div key={date}>
              <div style={{
                fontSize: '11px', fontWeight: 700,
                color: APPT_COLOR, letterSpacing: '0.03em',
                textTransform: 'uppercase', marginBottom: '6px',
              }}>
                {isoToLabel(date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {list.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex', gap: '10px', alignItems: 'center',
                      padding: '6px 8px', borderRadius: '6px',
                      borderLeft: `2px solid ${APPT_COLOR}`,
                      background: APPT_BG,
                    }}
                  >
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.7)',
                      fontSize: '11px', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: APPT_COLOR,
                      minWidth: '50px', textAlign: 'center',
                    }}>
                      {a.time_start ?? '—'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '12px' }}>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{a.title}</strong>
                      <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', gap: '8px', marginLeft: '6px' }}>
                        {a.location && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={10} /> {a.location}
                          </span>
                        )}
                        {a.participants && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Users size={10} /> {a.participants}
                          </span>
                        )}
                      </span>
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
