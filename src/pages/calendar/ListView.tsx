import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, CalendarClock, MapPin } from 'lucide-react';
import { resolveEventColor, type CalendarEvent } from './useCalendarEvents';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import { todayIso } from '@/utils/dateUtils';

interface Props {
  events: CalendarEvent[];
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

const MONTH_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_FR_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function daysBetween(iso: string, todayIsoStr: string): number {
  const a = new Date(iso + 'T00:00:00');
  const b = new Date(todayIsoStr + 'T00:00:00');
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Returns a relative header label like "Aujourd'hui", "Demain",
 *  "Dans 3 jours", "Dans 1 semaine", "Dans 2 semaines", "Dans 1 mois". */
function relativeLabel(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  if (days < 7) return `Dans ${days} jours`;
  if (days < 14) return 'Dans 1 semaine';
  if (days < 28) return `Dans ${Math.floor(days / 7)} semaines`;
  const months = Math.floor(days / 30);
  if (months <= 1) return 'Dans 1 mois';
  return `Dans ${months} mois`;
}

function absoluteLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = DAY_FR_LONG[d.getDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${d.getDate()} ${MONTH_FR[d.getMonth()]}`;
}

export default function ListView({ events, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const today = todayIso();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (e: CalendarEvent): CategoryColor => resolveEventColor(e, typeMap);

  // Agenda = future-only: today included, strictly anything before today excluded.
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (e.date < today) return false;
      if (e.status === 'cancelled' || e.status === 'completed') return false;
      if (typeFilter && e.type !== typeFilter) return false;
      if (locationFilter && e.location !== locationFilter) return false;
      if (search && !(`${e.title} ${e.location} ${e.animator}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [events, today, typeFilter, locationFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        padding: '8px 14px', maxWidth: 440,
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 999,
      }}>
        <Search size={14} style={{ color: 'var(--ink-3)' }} />
        <input
          type="text"
          placeholder="Rechercher dans l'agenda…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 13, color: 'var(--ink)',
          }}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {grouped.length === 0 && (
          <div style={{
            padding: 48, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <CalendarClock size={32} style={{ color: 'var(--ink-4)' }} />
            <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
              Aucun événement à venir
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, maxWidth: 360 }}>
              {search
                ? 'Essayez un autre mot-clé ou retirez les filtres.'
                : "L'agenda ne montre que les activités futures. Passez à l'onglet Historique pour voir les passées."}
            </p>
          </div>
        )}

        {grouped.map(([date, list]) => {
          const days = daysBetween(date, today);
          return (
            <div key={date}>
              <div style={{
                padding: '10px 18px 8px', background: 'var(--surface-2)',
                position: 'sticky', top: 0, zIndex: 1,
                borderBottom: '1px solid var(--line)',
              }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--terra-deep)',
                  fontFamily: 'var(--font-serif)', letterSpacing: -0.2,
                }}>
                  {relativeLabel(days)}
                </div>
                <div style={{
                  fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2,
                  textTransform: 'capitalize',
                }}>
                  {absoluteLabel(date)}
                </div>
              </div>
              {list.map((e) => {
                const c = colorFor(e);
                const isHover = hoveredId === e.id;
                const isAppt = e.source === 'appointment';
                return (
                  <div
                    key={e.id}
                    onClick={() => navigate(e.link)}
                    onMouseEnter={() => setHoveredId(e.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex', gap: 14, padding: '12px 18px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer', alignItems: 'center',
                      background: isHover ? 'var(--surface-2)' : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div className="num" style={{
                      width: 52, textAlign: 'center', padding: '4px 6px',
                      borderRadius: 6, background: 'var(--surface-2)',
                      fontSize: 12, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--ink-2)',
                    }}>
                      {e.time ?? '—'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {isAppt && <CalendarClock size={12} style={{ color: c.color }} />}
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
                          {e.title}
                        </span>
                        <span className="chip" style={{ background: c.bg, color: c.color }}>
                          {categoryLabel(c)}
                        </span>
                      </div>
                      {(e.location || e.animator) && (
                        <div style={{
                          color: 'var(--ink-3)', fontSize: 11.5, marginTop: 3,
                          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        }}>
                          {e.location && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <MapPin size={10} /> {e.location}
                            </span>
                          )}
                          {e.animator && <span>{e.animator}</span>}
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      size={14}
                      style={{
                        color: 'var(--ink-4)',
                        opacity: isHover ? 1 : 0,
                        transition: 'opacity 0.12s ease',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
