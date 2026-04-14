import { useState } from 'react';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';
import type { Appointment } from '@/db/types';

interface Props {
  appointment: Appointment;
  type: CategoryColor;
  showDate?: boolean;
  actions?: React.ReactNode;
  inlineRow?: React.ReactNode;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  planned:   { label: 'Planifié', color: '#1E40AF' },
  completed: { label: 'Terminé',  color: '#059669' },
  cancelled: { label: 'Annulé',   color: '#DC2626' },
};

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function AppointmentCard({ appointment, type, showDate = true, actions, inlineRow }: Props) {
  const [hover, setHover] = useState(false);
  const status = STATUS_META[appointment.status] ?? STATUS_META.planned;
  const t = type ?? { module: 'appointments', name: appointment.appointment_type, ...autoColor(appointment.appointment_type), label: null };

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
        <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{appointment.title}</strong>
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
        {showDate && appointment.date && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={11} /> {formatDate(appointment.date)}
          </span>
        )}
        {appointment.time_start && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> {appointment.time_start}{appointment.time_end ? ` — ${appointment.time_end}` : ''}
          </span>
        )}
        {appointment.location && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={11} /> {appointment.location}
          </span>
        )}
        {appointment.participants && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Users size={11} /> {appointment.participants}
          </span>
        )}
      </div>
      {appointment.description && (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {appointment.description}
        </p>
      )}
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
