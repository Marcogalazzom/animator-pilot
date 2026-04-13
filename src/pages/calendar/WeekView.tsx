import { useNavigate } from 'react-router-dom';
import { byWeek, type CalendarEvent } from './useCalendarEvents';
import { autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  mondayDate: string;
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()}`;
}

export default function WeekView({ events, mondayDate, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = events.filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const grouped = byWeek(filtered, mondayDate);
  const days = Object.keys(grouped);
  const today = todayIso();

  function splitMorningAfternoon(list: CalendarEvent[]) {
    const morning: CalendarEvent[] = [];
    const afternoon: CalendarEvent[] = [];
    for (const e of list) {
      const t = e.time ?? '';
      if (t && t < '12:00') morning.push(e);
      else afternoon.push(e);
    }
    return { morning, afternoon };
  }

  function renderCell(e: CalendarEvent) {
    const c = colorFor(e.type);
    return (
      <div
        key={e.id}
        onClick={() => navigate(e.link)}
        style={{
          fontSize: '10px', padding: '3px 5px', marginBottom: '2px',
          background: c.bg, color: c.color, borderRadius: '3px',
          cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        title={`${e.time ?? ''} ${e.title} · ${e.location}`}
      >
        <strong>{e.time ?? ''}</strong> {e.title}
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
        <div />
        {days.map((d, i) => {
          const isToday = d === today;
          const isWeekend = i >= 5;
          return (
            <div
              key={d}
              style={{
                padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 600,
                background: isToday ? '#EFF6FF' : 'transparent',
                color: isWeekend ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                borderLeft: '1px solid var(--color-border)',
              }}
            >
              {DAY_LABELS[i]} {shortDate(d)}
            </div>
          );
        })}
      </div>

      {(['morning', 'afternoon'] as const).map((slot) => (
        <div key={slot} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)', minHeight: '90px' }}>
          <div style={{ padding: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', borderRight: '1px solid var(--color-border)' }}>
            {slot === 'morning' ? 'Matin' : 'Après-midi'}
          </div>
          {days.map((d) => {
            const list = grouped[d];
            const { morning, afternoon } = splitMorningAfternoon(list);
            const cellList = slot === 'morning' ? morning : afternoon;
            const isToday = d === today;
            return (
              <div
                key={d}
                style={{
                  padding: '6px', borderLeft: '1px solid var(--color-border)',
                  background: isToday ? '#F8FAFF' : 'transparent',
                }}
              >
                {cellList.map(renderCell)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
