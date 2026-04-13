import { useState } from 'react';
import { Calendar, Clock, MapPin, Users, User } from 'lucide-react';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';
import type { Activity } from '@/db/types';

interface Props {
  activity: Activity;
  type: CategoryColor;
  showDate?: boolean;
  actions?: React.ReactNode;
  inlineRow?: React.ReactNode;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  planned:     { label: 'Planifié',    color: '#1E40AF' },
  in_progress: { label: 'En cours',    color: '#D97706' },
  completed:   { label: 'Terminé',     color: '#059669' },
  cancelled:   { label: 'Annulé',      color: '#DC2626' },
};

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ActivityCard({ activity, type, showDate = true, actions, inlineRow }: Props) {
  const [hover, setHover] = useState(false);
  const status = STATUS_META[activity.status] ?? STATUS_META.planned;
  const t = type ?? { module: 'activities', name: activity.activity_type, ...autoColor(activity.activity_type), label: null };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: '14px 16px',
        borderLeft: `3px solid ${t.color}`,
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{activity.title}</strong>
        <span style={{
          fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
          color: t.color, backgroundColor: t.bg,
          border: `1px solid ${t.color}33`,
          fontWeight: 500,
        }}>
          {categoryLabel(t)}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: status.color }}>{status.label}</span>
      </div>
      <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
        {showDate && activity.date && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={11} /> {formatDate(activity.date)}
          </span>
        )}
        {activity.time_start && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> {activity.time_start}{activity.time_end ? ` — ${activity.time_end}` : ''}
          </span>
        )}
        {activity.location && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={11} /> {activity.location}
          </span>
        )}
        {activity.max_participants > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Users size={11} /> {activity.actual_participants}/{activity.max_participants}
          </span>
        )}
        {activity.animator_name && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <User size={11} /> {activity.animator_name}
          </span>
        )}
      </div>
      {inlineRow}
      {actions && (
        <div
          style={{
            display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px',
            borderTop: '1px dashed var(--color-border)', justifyContent: 'flex-end',
            opacity: hover ? 1 : 0,
            transition: 'var(--transition-fast)',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
