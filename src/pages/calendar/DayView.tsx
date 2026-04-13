import { useNavigate } from 'react-router-dom';
import { byDay, type CalendarEvent } from './useCalendarEvents';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  date: string;                       // YYYY-MM-DD
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DayView({ events, date, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  function typeFor(name: string): CategoryColor {
    return typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };
  }

  const dayEvents = byDay(events, date).filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const isToday = date === todayIso();
  const now = nowTimeString();

  // L'activité "en cours" : commencée dans les 30 dernières minutes (si aujourd'hui).
  const currentId = (() => {
    if (!isToday) return null;
    const [nh, nm] = now.split(':').map(Number);
    const nowMin = nh * 60 + nm;
    let pick: string | null = null;
    for (const e of dayEvents) {
      if (!e.time) continue;
      const [h, m] = e.time.split(':').map(Number);
      const eMin = h * 60 + m;
      if (eMin <= nowMin && nowMin - eMin <= 30) pick = e.id;
    }
    return pick;
  })();

  if (dayEvents.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucune activité ce jour.</p>;
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {dayEvents.map((e) => {
        const t = typeFor(e.type);
        const isCurrent = e.id === currentId;
        return (
          <div
            key={e.id}
            onClick={() => navigate(e.link)}
            style={{
              display: 'flex', gap: '12px', padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: isCurrent ? '#FEF9EE' : 'transparent',
              cursor: 'pointer',
              alignItems: 'center',
            }}
          >
            <div style={{ width: '60px', fontWeight: 600, fontSize: '13px', color: isCurrent ? '#D97706' : 'var(--color-text-primary)' }}>
              {isCurrent && '▸ '}{e.time ?? '—'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '13px' }}>
                {e.title}
                {' '}
                <span style={{
                  fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                  color: t.color, backgroundColor: t.bg, marginLeft: '4px',
                }}>{categoryLabel(t)}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {e.location || '(sans lieu)'}
                {e.animator && ` · ${e.animator}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
