import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, User } from 'lucide-react';
import { byDay, type CalendarEvent } from './useCalendarEvents';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  date: string;
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

import { todayIso } from './dateUtils';

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function DayView({ events, date, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const typeMap = new Map(types.map((c) => [c.name, c]));
  function typeFor(name: string): CategoryColor {
    return typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };
  }

  const dayEvents = byDay(events, date).filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const isToday = date === todayIso();
  const now = nowTimeString();

  const currentId = (() => {
    if (!isToday) return null;
    const [nh, nm] = now.split(':').map(Number);
    const nowMin = nh * 60 + nm;
    let pick: string | null = null;
    for (const e of dayEvents) {
      if (!e.time) continue;
      const [h, m] = e.time.split(':').map(Number);
      const eMin = h * 60 + m;
      if (eMin <= nowMin && nowMin - eMin <= 30) pick = e.id;
    }
    return pick;
  })();

  if (dayEvents.length === 0) {
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
      backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)', overflow: 'hidden',
    }}>
      {dayEvents.map((e, i) => {
        const t = typeFor(e.type);
        const isCurrent = e.id === currentId;
        const isHover = hoveredId === e.id;
        const accent = isCurrent ? 'var(--color-now)' : t.color;
        return (
          <div
            key={e.id}
            onClick={() => navigate(e.link)}
            onMouseEnter={() => setHoveredId(e.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: 'relative',
              display: 'flex', gap: '14px', padding: '14px 18px 14px 22px',
              borderBottom: i === dayEvents.length - 1 ? 'none' : '1px solid var(--color-border)',
              background: isCurrent ? 'var(--color-now-bg)' : (isHover ? 'var(--color-bg-soft)' : 'transparent'),
              cursor: 'pointer',
              alignItems: 'center',
              transition: 'var(--transition-fast)',
              animation: 'fade-up 180ms ease-out both',
              animationDelay: `${Math.min(i, 8) * 20}ms`,
            }}
          >
            {/* Bande latérale couleur catégorie (ou "now") */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: isCurrent ? '4px' : '3px',
              background: accent,
            }} />

            {/* Chip heure */}
            <div style={{
              width: '62px', textAlign: 'center',
              padding: '6px 0', borderRadius: '6px',
              background: isCurrent ? 'rgba(217,119,6,0.15)' : 'var(--color-bg-soft)',
              color: isCurrent ? 'var(--color-now)' : 'var(--color-text-primary)',
              fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {isCurrent && '▸ '}{e.time ?? '—'}
            </div>

            {/* Contenu */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {e.title}
                </span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
                  color: t.color, backgroundColor: t.bg,
                  border: `1px solid ${t.color}33`,
                  fontWeight: 500, fontFamily: 'var(--font-sans)',
                }}>
                  {categoryLabel(t)}
                </span>
              </div>
              <div style={{
                fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px',
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={11} />
                  {e.location || '(sans lieu)'}
                </span>
                {e.animator && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <User size={11} />
                    {e.animator}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
