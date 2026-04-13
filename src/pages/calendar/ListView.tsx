import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from './useCalendarEvents';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';

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

export default function ListView({ events, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (locationFilter && e.location !== locationFilter) return false;
      if (search && !(`${e.title} ${e.location} ${e.animator}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [events, typeFilter, locationFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '14px', maxWidth: '440px' }}>
        <Search size={15} style={{
          position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
          color: focused ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          transition: 'var(--transition-fast)',
        }} />
        <input
          type="text"
          placeholder="Rechercher un titre, un lieu, un intervenant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', padding: '10px 14px 10px 36px',
            border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: '10px',
            fontSize: '13px', fontFamily: 'var(--font-sans)',
            background: 'var(--color-surface)',
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(30,64,175,0.12)' : 'none',
            transition: 'var(--transition-fast)',
          }}
        />
      </div>

      <div style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', overflow: 'hidden',
      }}>
        {grouped.length === 0 && (
          <p style={{
            color: 'var(--color-text-secondary)', fontSize: '13px',
            padding: '40px', textAlign: 'center', margin: 0,
          }}>
            Aucune activité.
          </p>
        )}
        {grouped.map(([date, list]) => (
          <div key={date}>
            <div style={{
              padding: '12px 18px', background: 'var(--color-bg-soft)',
              fontSize: '14px', fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              position: 'sticky', top: 0, zIndex: 1,
              borderLeft: '3px solid var(--color-primary)',
              textTransform: 'capitalize',
            }}>
              {formatDay(date)}
            </div>
            {list.map((e) => {
              const c = colorFor(e.type);
              const isHover = hoveredId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(e.link)}
                  onMouseEnter={() => setHoveredId(e.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex', gap: '14px', padding: '12px 18px',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer', alignItems: 'center',
                    background: isHover ? 'var(--color-bg-soft)' : 'transparent',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <div style={{
                    width: '52px', textAlign: 'center', padding: '4px 6px',
                    borderRadius: '6px', background: 'var(--color-bg-soft)',
                    fontSize: '12px', fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text-primary)',
                  }}>
                    {e.time ?? '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {e.title}
                      </span>
                      <span style={{
                        fontSize: '10px', padding: '1px 7px', borderRadius: '10px',
                        color: c.color, backgroundColor: c.bg,
                        border: `1px solid ${c.color}33`,
                        fontWeight: 500,
                      }}>
                        {categoryLabel(c)}
                      </span>
                    </div>
                    {(e.location || e.animator) && (
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginTop: '3px' }}>
                        {[e.location, e.animator].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={14}
                    style={{
                      color: 'var(--color-text-secondary)',
                      opacity: isHover ? 1 : 0,
                      transform: isHover ? 'translateX(0)' : 'translateX(-4px)',
                      transition: 'var(--transition-fast)',
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
