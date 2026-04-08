import { useState, useMemo, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, ShieldCheck, Landmark, BookOpen, CalendarDays } from 'lucide-react';
import { useCalendarData } from './calendar/useCalendarData';
import type { CalendarModule } from './calendar/useCalendarData';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_COLORS: Record<CalendarModule, string> = {
  projects:   'var(--color-primary)',
  compliance: 'var(--color-success)',
  tutelles:   'var(--color-warning)',
  training:   '#9333ea',
};

const MODULE_BG: Record<CalendarModule, string> = {
  projects:   'rgba(30,64,175,0.08)',
  compliance: 'rgba(22,163,74,0.08)',
  tutelles:   'rgba(217,119,6,0.08)',
  training:   'rgba(147,51,234,0.08)',
};

const MODULE_LABELS: Record<CalendarModule, string> = {
  projects:   'Projets',
  compliance: 'Conformité',
  tutelles:   'Tutelles',
  training:   'Formations',
};

const MODULE_ICONS: Record<CalendarModule, ReactElement> = {
  projects:   <FolderKanban size={11} />,
  compliance: <ShieldCheck size={11} />,
  tutelles:   <Landmark size={11} />,
  training:   <BookOpen size={11} />,
};

const FILTER_OPTIONS: Array<{ key: CalendarModule | 'all'; label: string }> = [
  { key: 'all',        label: 'Tous' },
  { key: 'projects',   label: 'Projets' },
  { key: 'compliance', label: 'Conformité' },
  { key: 'tutelles',   label: 'Tutelles' },
  { key: 'training',   label: 'Formations' },
];

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MONTH_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysFromNow(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_FR[m - 1]} ${y}`;
}

function formatDayMonth(dateStr: string): { day: number; month: string } {
  const d = new Date(dateStr);
  return { day: d.getDate(), month: MONTH_SHORT[d.getMonth()] };
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate();
  const { events, loading } = useCalendarData();
  const [activeFilter, setActiveFilter] = useState<CalendarModule | 'all'>('all');

  const todayKey = getTodayKey();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayISO = todayDate.toISOString().slice(0, 10);

  // Filtered events
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return events;
    return events.filter(e => e.module === activeFilter);
  }, [events, activeFilter]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const ev of filtered) {
      const key = getMonthKey(ev.date);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    // Sort months ASC
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalCount = filtered.length;
  const upcomingCount = filtered.filter(e => e.date >= todayISO).length;
  const overdueCount  = filtered.filter(e => e.date < todayISO).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ width: '220px', height: '28px', borderRadius: '6px', background: 'var(--color-border)' }} className="shimmer" />
        <div style={{ width: '100%', height: '400px', borderRadius: '10px', background: 'var(--color-surface)' }} className="shimmer" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '900px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.2,
          }}>
            Calendrier
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            margin: '4px 0 0',
            fontFamily: 'var(--font-sans)',
          }}>
            Vue unifiée des échéances
          </p>
        </div>

        {/* Summary badges */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          {overdueCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '5px 12px',
              background: 'rgba(220,38,38,0.07)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: '20px',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}>
              {overdueCount} en retard
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px',
            background: 'rgba(30,64,175,0.06)',
            color: 'var(--color-primary)',
            border: '1px solid rgba(30,64,175,0.15)',
            borderRadius: '20px',
            fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
          }}>
            <CalendarDays size={12} />
            {upcomingCount} à venir
          </span>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '10px 14px',
      }}>
        <span style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          alignSelf: 'center',
          marginRight: '6px',
          fontWeight: 500,
        }}>
          Module :
        </span>
        {FILTER_OPTIONS.map(opt => {
          const isActive = activeFilter === opt.key;
          const color = opt.key !== 'all' ? MODULE_COLORS[opt.key as CalendarModule] : 'var(--color-primary)';
          return (
            <button
              key={opt.key}
              onClick={() => setActiveFilter(opt.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                border: isActive ? `1.5px solid ${color}` : '1.5px solid var(--color-border)',
                background: isActive
                  ? (opt.key !== 'all' ? MODULE_BG[opt.key as CalendarModule] : 'rgba(30,64,175,0.07)')
                  : 'transparent',
                color: isActive ? color : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.key !== 'all' && MODULE_ICONS[opt.key as CalendarModule]}
              {opt.label}
              {opt.key !== 'all' && (
                <span style={{
                  background: isActive ? color : 'var(--color-border)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  borderRadius: '10px',
                  padding: '0 5px',
                  fontSize: '10px',
                  fontWeight: 700,
                  lineHeight: '16px',
                }}>
                  {events.filter(e => e.module === opt.key).length}
                </span>
              )}
            </button>
          );
        })}
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          alignSelf: 'center',
        }}>
          {totalCount} échéance{totalCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Timeline ── */}
      {grouped.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--color-surface)',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
        }}>
          Aucune échéance pour ce filtre.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {grouped.map(([monthKey, monthEvents]) => {
            const isPastMonth = monthKey < todayKey;
            return (
              <div key={monthKey}>
                {/* Month header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '10px',
                }}>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: isPastMonth ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                    margin: 0,
                  }}>
                    {getMonthLabel(monthKey)}
                  </h2>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    background: 'var(--color-border)',
                  }} />
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '2px 8px',
                  }}>
                    {monthEvents.length}
                  </span>
                </div>

                {/* Today marker: render before first future event in current month */}
                {(() => {
                  const currentMonthKey = getTodayKey();
                  if (monthKey === currentMonthKey) {
                    const hasToday = monthEvents.some(e => e.date === todayISO);
                    if (!hasToday) {
                      return (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                        }}>
                          <div style={{ width: '38px', flexShrink: 0 }} />
                          <div style={{
                            flex: 1,
                            height: '2px',
                            background: 'var(--color-primary)',
                            opacity: 0.5,
                            borderRadius: '1px',
                          }} />
                          <span style={{
                            fontSize: '10px',
                            color: 'var(--color-primary)',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}>
                            Aujourd'hui
                          </span>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}

                {/* Events list */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}>
                  {monthEvents.map((ev, idx) => {
                    const daysLeft = getDaysFromNow(ev.date);
                    const isPast = daysLeft < 0;
                    const isToday = daysLeft === 0;
                    const { day, month } = formatDayMonth(ev.date);
                    const color = MODULE_COLORS[ev.module];

                    return (
                      <div key={ev.id}>
                        {/* Today separator line */}
                        {isToday && (
                          <div style={{
                            height: '2px',
                            background: 'var(--color-primary)',
                            opacity: 0.4,
                            margin: '0',
                          }} />
                        )}
                        {/* Divider between items */}
                        {idx > 0 && (
                          <div style={{ height: '1px', background: 'var(--color-border)', margin: '0 14px' }} />
                        )}
                        <button
                          onClick={() => navigate(ev.link_path)}
                          title={`Aller à ${MODULE_LABELS[ev.module]}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            width: '100%',
                            padding: '11px 16px',
                            background: isToday
                              ? 'rgba(30,64,175,0.04)'
                              : isPast
                                ? 'transparent'
                                : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.12s ease',
                            opacity: isPast ? 0.55 : 1,
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,64,175,0.04)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = isToday
                              ? 'rgba(30,64,175,0.04)'
                              : 'transparent';
                          }}
                        >
                          {/* Colored dot */}
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: color,
                            flexShrink: 0,
                          }} />

                          {/* Date */}
                          <div style={{
                            width: '36px',
                            flexShrink: 0,
                            textAlign: 'center',
                          }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-display)',
                              color: isPast ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                              lineHeight: 1.1,
                            }}>
                              {day}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-sans)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}>
                              {month}
                            </div>
                          </div>

                          {/* Title */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              fontFamily: 'var(--font-sans)',
                              color: isPast ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {ev.title}
                            </div>
                          </div>

                          {/* Module badge */}
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            background: MODULE_BG[ev.module],
                            color: color,
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-sans)',
                            flexShrink: 0,
                            border: `1px solid ${color}20`,
                          }}>
                            {MODULE_ICONS[ev.module]}
                            {MODULE_LABELS[ev.module]}
                          </div>

                          {/* Days remaining badge */}
                          <div style={{
                            flexShrink: 0,
                            minWidth: '64px',
                            textAlign: 'right',
                          }}>
                            {isToday ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                background: 'rgba(30,64,175,0.1)',
                                color: 'var(--color-primary)',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-sans)',
                              }}>
                                Aujourd'hui
                              </span>
                            ) : isPast ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                background: 'rgba(220,38,38,0.07)',
                                color: 'var(--color-danger)',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-sans)',
                              }}>
                                il y a {Math.abs(daysLeft)}j
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                background: daysLeft <= 7
                                  ? 'rgba(220,38,38,0.07)'
                                  : daysLeft <= 30
                                    ? 'rgba(217,119,6,0.07)'
                                    : 'rgba(15,23,42,0.05)',
                                color: daysLeft <= 7
                                  ? 'var(--color-danger)'
                                  : daysLeft <= 30
                                    ? 'var(--color-warning)'
                                    : 'var(--color-text-secondary)',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-sans)',
                              }}>
                                dans {daysLeft}j
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
