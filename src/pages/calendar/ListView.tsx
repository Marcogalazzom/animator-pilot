import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
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
      <div style={{ position: 'relative', marginBottom: '12px', maxWidth: '400px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
        <input
          type="text" placeholder="Rechercher une activité, un lieu, un intervenant..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}
        />
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {grouped.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
            Aucune activité.
          </p>
        )}
        {grouped.map(([date, list]) => (
          <div key={date}>
            <div style={{
              padding: '8px 16px', background: 'var(--color-background)',
              fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
              color: 'var(--color-text-secondary)', letterSpacing: '0.05em',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              {formatDay(date)}
            </div>
            {list.map((e) => {
              const c = colorFor(e.type);
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(e.link)}
                  style={{ display: 'flex', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', alignItems: 'center' }}
                >
                  <div style={{ width: '50px', fontSize: '12px', fontWeight: 600 }}>{e.time ?? '—'}</div>
                  <div style={{ flex: 1, fontSize: '13px' }}>
                    {e.title}
                    {' '}
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', color: c.color, backgroundColor: c.bg }}>
                      {categoryLabel(c)}
                    </span>
                    {(e.location || e.animator) && (
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginLeft: '6px' }}>
                        · {[e.location, e.animator].filter(Boolean).join(' — ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
