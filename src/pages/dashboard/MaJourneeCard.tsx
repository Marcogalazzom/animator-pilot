import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

import { useNow } from '@/hooks/useNow';
import {
  groupEventsByMoment,
  allDone,
  formatHourFr,
  type MomentGroup,
  type MomentItem,
} from './groupByMoment';
import {
  resolveEventColor,
  type CalendarEvent,
} from '../calendar/useCalendarEvents';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';

interface MaJourneeCardProps {
  events: CalendarEvent[];
  typeMap: Map<string, CategoryColor>;
  onOpenEvent: (e: CalendarEvent) => void;
}

export default function MaJourneeCard({ events, typeMap, onOpenEvent }: MaJourneeCardProps) {
  const now = useNow();
  const groups = useMemo(() => groupEventsByMoment(events, now), [events, now]);
  const bilanMode = allDone(groups);

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 18 }}>
        <div className="serif" style={{ fontSize: 20, fontWeight: 500, letterSpacing: -0.3 }}>
          Ma journée
        </div>
        <div style={{ flex: 1 }} />
        <Link to="/calendar" style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>
          Tout voir →
        </Link>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Pas d'activité prévue aujourd'hui.
        </div>
      ) : bilanMode ? (
        <BilanRecap groups={groups} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map((g) => (
            <MomentBlock
              key={g.moment}
              group={g}
              typeMap={typeMap}
              onOpenEvent={onOpenEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ───── Sous-composants ─────

function MomentBlock({
  group,
  typeMap,
  onOpenEvent,
}: {
  group: MomentGroup;
  typeMap: Map<string, CategoryColor>;
  onOpenEvent: (e: CalendarEvent) => void;
}) {
  const doneItems = group.items.filter((i) => i.state === 'done');
  const liveItems = group.items.filter((i) => i.state !== 'done');

  return (
    <div>
      <div
        className="serif"
        style={{
          fontSize: 14, fontStyle: 'italic', color: 'var(--ink-3)',
          marginBottom: 10, fontWeight: 500,
        }}
      >
        {group.label}
      </div>

      {doneItems.length > 0 && (
        <div style={{ marginBottom: liveItems.length > 0 ? 12 : 0 }}>
          {doneItems.map((item) => (
            <DoneRow key={item.event.id} item={item} />
          ))}
        </div>
      )}

      {liveItems.length > 0 && (
        <div style={{ position: 'relative' }}>
          {liveItems.map((item, idx) => (
            <LiveRow
              key={item.event.id}
              item={item}
              typeMap={typeMap}
              onOpenEvent={onOpenEvent}
              hasLineBelow={idx < liveItems.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DoneRow({ item }: { item: MomentItem }) {
  const endMin = item.endMin ?? (item.startMin !== null ? item.startMin + 60 : null);
  const endLabel = endMin !== null ? formatHourFr(endMin) : null;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, color: 'var(--ink-4)',
        padding: '4px 0 4px 6px',
      }}
    >
      <span style={{ color: 'var(--line-strong)', fontSize: 12 }}>✓</span>
      <span
        style={{
          textDecoration: 'line-through',
          textDecorationColor: 'var(--line-strong)',
          textDecorationThickness: '1px',
        }}
      >
        {item.event.title}
      </span>
      {endLabel && (
        <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>
          — terminé à {endLabel}
        </span>
      )}
    </div>
  );
}

function LiveRow({
  item,
  typeMap,
  onOpenEvent,
  hasLineBelow,
}: {
  item: MomentItem;
  typeMap: Map<string, CategoryColor>;
  onOpenEvent: (e: CalendarEvent) => void;
  hasLineBelow: boolean;
}) {
  const { event, state } = item;
  const active = state === 'now';
  const cat = resolveEventColor(event, typeMap);

  return (
    <div
      style={{
        display: 'grid', gap: 12, padding: '8px 0',
        gridTemplateColumns: '54px 14px 1fr auto',
        alignItems: 'center', position: 'relative',
      }}
    >
      <div
        className="num"
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: active ? 'var(--terra-deep)' : 'var(--ink-3)',
          fontWeight: active ? 700 : 400,
        }}
      >
        {event.time ?? '—'}
      </div>

      {/* Dot + filet vertical vers l'event suivant (dans le même moment) */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {hasLineBelow && (
          <div
            style={{
              position: 'absolute',
              top: 18, bottom: -16, width: 1,
              background: 'var(--line)',
            }}
          />
        )}
        <div
          style={{
            width: 12, height: 12, borderRadius: '50%',
            background: active ? 'var(--terra)' : 'var(--surface)',
            border: `2px solid ${active ? 'var(--terra)' : 'var(--line-strong)'}`,
            boxShadow: active ? '0 0 0 4px var(--terra-soft)' : 'none',
            position: 'relative', zIndex: 1,
          }}
        />
      </div>

      <button
        onClick={() => onOpenEvent(event)}
        style={{
          textAlign: 'left',
          padding: '10px 14px', borderRadius: 10,
          background: active ? 'var(--terra-soft)' : 'var(--surface-2)',
          border: `1px solid ${active ? 'var(--terra-soft)' : 'var(--line)'}`,
          cursor: 'pointer',
          transition: 'box-shadow 0.18s ease',
        }}
        onMouseEnter={(ev) => (ev.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
        onMouseLeave={(ev) => (ev.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              fontWeight: 600, fontSize: 14.5,
              color: active ? 'var(--terra-deep)' : 'var(--ink)',
            }}
          >
            {event.title}
          </div>
          {active && (
            <span
              className="chip live no-dot"
              style={{
                fontSize: 10, textTransform: 'uppercase',
                letterSpacing: 0.1, fontWeight: 700, padding: '2px 8px',
              }}
            >
              en cours
            </span>
          )}
        </div>
        {event.location && (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12.5, marginTop: 4,
              color: active ? 'var(--terra-deep)' : 'var(--ink-3)',
              opacity: active ? 0.85 : 1,
            }}
          >
            <MapPin size={11} /> {event.location}
          </div>
        )}
      </button>

      <span
        className="chip no-dot"
        style={{
          fontSize: 11, padding: '3px 10px',
          color: cat.color, backgroundColor: cat.bg,
          fontWeight: 500, flexShrink: 0,
        }}
      >
        {categoryLabel(cat)}
      </span>
    </div>
  );
}

function BilanRecap({ groups }: { groups: MomentGroup[] }) {
  const done = groups.flatMap((g) => g.items);
  return (
    <div>
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          color: 'var(--ink-2)', fontSize: 13, fontWeight: 500,
          marginBottom: 14,
        }}
      >
        <span style={{ color: 'var(--sage-deep, var(--ink-3))' }}>✓</span>
        Journée terminée
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {done.map((item) => {
          const startLabel = item.startMin !== null ? formatHourFr(item.startMin) : '—';
          return (
            <div
              key={item.event.id}
              style={{
                display: 'flex', gap: 10, fontSize: 13,
                color: 'var(--ink-3)',
                padding: '3px 0',
              }}
            >
              <span
                className="num"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--ink-4)', minWidth: 48,
                }}
              >
                {startLabel}
              </span>
              <span style={{ color: 'var(--ink-2)' }}>{item.event.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
