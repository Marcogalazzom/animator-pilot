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

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
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
        onClick={(ev) => { ev.stopPropagation(); navigate(e.link); }}
        style={{
          fontSize: '11px', padding: '5px 7px', marginBottom: '3px',
          background: c.bg, color: c.color,
          borderRadius: '4px',
          borderLeft: `2px solid ${c.color}`,
          cursor: 'pointer',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'var(--transition-fast)',
          lineHeight: 1.3,
        }}
        onMouseEnter={(ev) => {
          ev.currentTarget.style.transform = 'translateY(-1px)';
          ev.currentTarget.style.boxShadow = 'var(--shadow-card)';
        }}
        onMouseLeave={(ev) => {
          ev.currentTarget.style.transform = 'none';
          ev.currentTarget.style.boxShadow = 'none';
        }}
        title={`${e.time ?? ''} ${e.title}${e.location ? ' · ' + e.location : ''}`}
      >
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{e.time ?? ''}</strong> {e.title}
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div />
        {days.map((d, i) => {
          const isToday = d === today;
          const isWeekend = i >= 5;
          return (
            <div
              key={d}
              style={{
                padding: '12px 8px 10px', textAlign: 'center',
                background: isToday ? 'rgba(30,64,175,0.04)' : 'transparent',
                opacity: isWeekend ? 0.55 : 1,
                borderLeft: '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              <div style={{
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em',
                color: 'var(--color-text-secondary)', textTransform: 'uppercase',
              }}>
                {DAY_LABELS[i]}
              </div>
              <div style={{
                fontSize: '20px', fontWeight: 700,
                color: isToday ? 'var(--color-primary)' : 'var(--color-text-primary)',
                fontFamily: 'var(--font-display)',
                lineHeight: 1.1, marginTop: '2px',
              }}>
                {shortDate(d)}
              </div>
              {isToday && (
                <div style={{
                  position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)',
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--color-primary)',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Slots */}
      {(['morning', 'afternoon'] as const).map((slot, slotIdx) => (
        <div
          key={slot}
          style={{
            display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)',
            borderBottom: slotIdx === 0 ? '1px solid var(--color-border)' : 'none',
            minHeight: '130px',
          }}
        >
          <div style={{
            padding: '12px 10px', fontSize: '10px', fontWeight: 700,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-bg-soft)',
          }}>
            {slot === 'morning' ? 'Matin' : 'Après-midi'}
          </div>
          {days.map((d, i) => {
            const list = grouped[d];
            const { morning, afternoon } = splitMorningAfternoon(list);
            const cellList = slot === 'morning' ? morning : afternoon;
            const isToday = d === today;
            const isWeekend = i >= 5;
            return (
              <div
                key={d}
                style={{
                  padding: '8px', borderLeft: '1px solid var(--color-border)',
                  background: isToday
                    ? 'rgba(30,64,175,0.025)'
                    : isWeekend ? 'var(--color-bg-soft)' : 'transparent',
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
