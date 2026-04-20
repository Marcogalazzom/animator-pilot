import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, CalendarClock, History } from 'lucide-react';
import { resolveEventColor, type CalendarEvent } from './useCalendarEvents';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import { todayIso } from '@/utils/dateUtils';

interface Props {
  events: CalendarEvent[];
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

const MONTH_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}

const PAST_STATUSES = new Set(['completed', 'cancelled']);

export default function HistoryView({ events, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const today = todayIso();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (e: CalendarEvent): CategoryColor => resolveEventColor(e, typeMap);

  // Past = date strictly before today, OR status completed/cancelled.
  const filtered = useMemo(() => {
    return events
      .filter((e) => e.date < today || PAST_STATUSES.has(e.status))
      .filter((e) => {
        if (typeFilter && e.type !== typeFilter) return false;
        if (locationFilter && e.location !== locationFilter) return false;
        if (search && !(`${e.title} ${e.location} ${e.animator}`.toLowerCase().includes(search.toLowerCase()))) return false;
        return true;
      });
  }, [events, today, typeFilter, locationFilter, search]);

  // Group by date, descending (most recent first).
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
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
          placeholder="Rechercher dans l'historique…"
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
            <History size={32} style={{ color: 'var(--ink-4)' }} />
            <div className="serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
              Aucun événement passé
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, maxWidth: 360 }}>
              Les activités terminées et les rendez-vous passés apparaîtront ici.
            </p>
          </div>
        )}

        {grouped.map(([date, list]) => (
          <div key={date}>
            <div style={{
              padding: '10px 18px', background: 'var(--surface-2)',
              fontSize: 12, fontWeight: 600,
              color: 'var(--ink-3)',
              position: 'sticky', top: 0, zIndex: 1,
              borderBottom: '1px solid var(--line)',
              textTransform: 'capitalize',
              letterSpacing: 0.04,
            }}>
              {formatDay(date)}
            </div>
            {list.map((e) => {
              const c = colorFor(e);
              const isHover = hoveredId === e.id;
              const isAppt = e.source === 'appointment';
              const isCancelled = e.status === 'cancelled';
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
                    opacity: isCancelled ? 0.55 : 1,
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
                      <span style={{
                        fontSize: 13.5, fontWeight: 500, color: 'var(--ink)',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                      }}>
                        {e.title}
                      </span>
                      <span className="chip" style={{ background: c.bg, color: c.color }}>
                        {categoryLabel(c)}
                      </span>
                      {isCancelled && (
                        <span className="chip danger no-dot">Annulé</span>
                      )}
                      {e.status === 'completed' && (
                        <span className="chip done no-dot">Terminé</span>
                      )}
                    </div>
                    {(e.location || e.animator) && (
                      <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginTop: 3 }}>
                        {[e.location, e.animator].filter(Boolean).join(' · ')}
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
        ))}
      </div>
    </div>
  );
}
