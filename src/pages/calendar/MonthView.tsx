import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveEventColor, type CalendarEvent } from './useCalendarEvents';
import { type CategoryColor } from '@/db/categoryColors';
import { todayIso, mondayOf } from '@/utils/dateUtils';

interface Props {
  events: CalendarEvent[];
  /** Any date inside the month to display (typically the URL `date` param). */
  date: string;
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
  onPickDay: (iso: string) => void;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Build a 6×7 grid (rows × cols) of ISO dates starting on the Monday of
 *  the week containing the 1st of the month. Cells may overflow to the
 *  next month — those days are rendered grayed-out. */
function buildMonthGrid(anyDayInMonth: string): string[] {
  const [y, m] = anyDayInMonth.split('-').map(Number);
  const firstIso = `${y}-${pad(m)}-01`;
  const start = mondayOf(firstIso);
  const out: string[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(sy, sm - 1, sd + i));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

export default function MonthView({ events, date, types, typeFilter, locationFilter, onPickDay }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (e: CalendarEvent): CategoryColor => resolveEventColor(e, typeMap);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (locationFilter && e.location !== locationFilter) return false;
      return true;
    });
  }, [events, typeFilter, locationFilter]);

  const cells = useMemo(() => buildMonthGrid(date), [date]);
  const currentMonth = parseInt(date.slice(5, 7), 10);
  const today = todayIso();

  // Index events by date for O(1) cell lookup.
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [filtered]);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Weekday header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        borderBottom: '1px solid var(--line)', background: 'var(--surface-2)',
      }}>
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            style={{
              padding: '10px 8px', textAlign: 'center',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.06,
              textTransform: 'uppercase', color: 'var(--ink-3)',
              borderLeft: i > 0 ? '1px solid var(--line)' : 'none',
              opacity: i >= 5 ? 0.7 : 1,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6 rows × 7 cols */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gridAutoRows: 'minmax(96px, 1fr)',
      }}>
        {cells.map((iso, idx) => {
          const dayNum = parseInt(iso.slice(8, 10), 10);
          const monthNum = parseInt(iso.slice(5, 7), 10);
          const inMonth = monthNum === currentMonth;
          const isToday = iso === today;
          const col = idx % 7;
          const list = byDate.get(iso) ?? [];
          const visible = list.slice(0, 3);
          const overflow = list.length - visible.length;
          const isWeekend = col >= 5;

          return (
            <button
              key={iso}
              onClick={() => onPickDay(iso)}
              style={{
                position: 'relative',
                padding: '6px 6px 8px',
                borderLeft: col > 0 ? '1px solid var(--line)' : 'none',
                borderTop: idx >= 7 ? '1px solid var(--line)' : 'none',
                background: isToday
                  ? 'var(--terra-soft)'
                  : !inMonth ? 'var(--surface-2)' : isWeekend ? 'rgba(243, 239, 231, 0.4)' : 'var(--surface)',
                cursor: 'pointer',
                textAlign: 'left',
                border: 'none',
                outline: 'none',
                display: 'flex', flexDirection: 'column', gap: 4,
                opacity: inMonth ? 1 : 0.55,
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(ev) => {
                if (!isToday) ev.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(ev) => {
                if (isToday) ev.currentTarget.style.background = 'var(--terra-soft)';
                else if (!inMonth) ev.currentTarget.style.background = 'var(--surface-2)';
                else if (isWeekend) ev.currentTarget.style.background = 'rgba(243, 239, 231, 0.4)';
                else ev.currentTarget.style.background = 'var(--surface)';
              }}
            >
              {/* Day number */}
              <div className="num" style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--terra-deep)' : inMonth ? 'var(--ink)' : 'var(--ink-4)',
                alignSelf: 'flex-start',
              }}>
                {dayNum}
              </div>

              {/* Event chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, overflow: 'hidden' }}>
                {visible.map((e) => {
                  const c = colorFor(e);
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); navigate(e.link); }}
                      style={{
                        padding: '3px 5px', borderRadius: 3,
                        background: c.bg, color: c.color,
                        fontSize: 10.5, fontWeight: 500,
                        lineHeight: 1.25,
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      title={`${e.time ?? ''} ${e.title}${e.location ? ' · ' + e.location : ''}`}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {e.time && (
                          <span className="num" style={{
                            fontFamily: 'var(--font-mono)', fontWeight: 600, opacity: 0.85,
                            flexShrink: 0,
                          }}>
                            {e.time.slice(0, 5)}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                      </div>
                      {e.location && (
                        <div style={{
                          fontSize: 9.5, opacity: 0.75,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          marginTop: 1,
                        }}>
                          {e.location}
                        </div>
                      )}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{
                    fontSize: 10.5, color: 'var(--ink-3)',
                    padding: '2px 5px', fontWeight: 500,
                  }}>
                    +{overflow} autre{overflow > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
