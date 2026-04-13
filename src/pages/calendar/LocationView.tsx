import { useNavigate } from 'react-router-dom';
import { byLocation, type CalendarEvent } from './useCalendarEvents';
import { autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  date: string;
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

export default function LocationView({ events, date, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = events.filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const grouped = byLocation(filtered, date);
  const locations = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'fr'));

  if (locations.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucune activité ce jour.</p>;
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {locations.map((loc) => (
        <div key={loc} style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ width: '140px', padding: '12px', fontWeight: 600, fontSize: '12px', borderRight: '1px solid var(--color-border)' }}>
            {loc}
          </div>
          <div style={{ flex: 1, padding: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {grouped[loc].map((e) => {
              const c = colorFor(e.type);
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(e.link)}
                  style={{
                    fontSize: '11px', padding: '4px 8px', borderRadius: '4px',
                    background: c.bg, color: c.color, cursor: 'pointer',
                  }}
                  title={`${e.time ?? ''} ${e.title}${e.animator ? ' · ' + e.animator : ''}`}
                >
                  <strong>{e.time ?? '—'}</strong> {e.title}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
