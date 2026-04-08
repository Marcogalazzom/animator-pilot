import type { ReactElement } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KpiStatus = 'ok' | 'warning' | 'critical';

export interface KpiTrend {
  direction: 'up' | 'down' | 'neutral';
  value: string;
  /** When true, "up" is good (e.g. occupation). When false, "up" is bad (e.g. absenteeism). */
  upIsGood?: boolean;
}

export interface KpiCardProps {
  label:   string;
  value:   string;
  trend?:  KpiTrend;
  status:  KpiStatus;
  icon:    ReactElement;
  unit?:   string;
}

const STATUS_BORDER: Record<KpiStatus, string> = {
  ok:       'var(--color-success)',
  warning:  'var(--color-warning)',
  critical: 'var(--color-danger)',
};

const STATUS_BG: Record<KpiStatus, string> = {
  ok:       'rgba(5, 150, 105, 0.06)',
  warning:  'rgba(217, 119, 6, 0.06)',
  critical: 'rgba(220, 38, 38, 0.06)',
};

export default function KpiCard({ label, value, trend, status, icon, unit }: KpiCardProps) {
  const borderColor = STATUS_BORDER[status];
  const bgTint      = STATUS_BG[status];

  // Determine trend color
  let trendColor = 'var(--color-text-secondary)';
  if (trend) {
    const upIsGood = trend.upIsGood !== false; // default true
    if (trend.direction === 'up')   trendColor = upIsGood ? 'var(--color-success)' : 'var(--color-danger)';
    if (trend.direction === 'down') trendColor = upIsGood ? 'var(--color-danger)'  : 'var(--color-success)';
  }

  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
    ? TrendingDown
    : Minus;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        borderLeft: `3px solid ${borderColor}`,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Background tint blob */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: bgTint,
        pointerEvents: 'none',
      }} />

      {/* Icon + label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--color-text-secondary)', opacity: 0.7, display: 'flex' }}>
          {icon}
        </span>
        <span style={{
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{
          fontSize: '28px',
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          color: 'var(--color-text-primary)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            fontWeight: 500,
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: trendColor,
        }}>
          <TrendIcon size={13} strokeWidth={2.5} />
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}>
            {trend.value}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            fontWeight: 400,
          }}>
            vs mois précédent
          </span>
        </div>
      )}
    </div>
  );
}
