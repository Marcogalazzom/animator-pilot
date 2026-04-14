import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { byLocation, resolveEventColor, type CalendarEvent } from './useCalendarEvents';
import { type CategoryColor } from '@/db/categoryColors';

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
  const colorFor = (e: CalendarEvent): CategoryColor => resolveEventColor(e, typeMap);

  const filtered = events.filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const grouped = byLocation(filtered, date);
  const locations = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'fr'));

  if (locations.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: '40px', textAlign: 'center',
      }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
          Aucune activité ce jour.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)', overflow: 'hidden',
    }}>
      {locations.map((loc, rowIdx) => (
        <div
          key={loc}
          style={{
            display: 'flex',
            borderBottom: rowIdx === locations.length - 1 ? 'none' : '1px solid var(--color-border)',
            background: rowIdx % 2 === 1 ? 'var(--color-bg-soft)' : 'transparent',
            animation: 'fade-up 180ms ease-out both',
            animationDelay: `${Math.min(rowIdx, 6) * 30}ms`,
          }}
        >
          <div style={{
            width: '160px', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: '8px',
            borderRight: '1px solid var(--color-border)',
          }}>
            <MapPin size={13} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>
              {loc}
            </span>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {grouped[loc].map((e) => {
              const c = colorFor(e);
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(e.link)}
                  style={{
                    padding: '6px 10px', borderRadius: '6px',
                    background: c.bg,
                    borderLeft: `3px solid ${c.color}`,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                  }}
                  onMouseEnter={(ev) => {
                    ev.currentTarget.style.transform = 'translateY(-1px)';
                    ev.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                  onMouseLeave={(ev) => {
                    ev.currentTarget.style.transform = 'none';
                    ev.currentTarget.style.boxShadow = 'none';
                  }}
                  title={`${e.time ?? ''} ${e.title}${e.animator ? ' · ' + e.animator : ''}`}
                >
                  <span style={{
                    fontSize: '10px', fontWeight: 700, color: c.color,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
                  }}>
                    {e.time ?? '—'}
                  </span>
                  <span style={{
                    fontSize: '12px', fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '200px',
                  }}>
                    {e.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
