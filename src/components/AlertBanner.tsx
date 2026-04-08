import { AlertTriangle, XCircle } from 'lucide-react';

export interface AlertItem {
  indicator: string;
  value:     number;
  threshold: number;
  severity:  'warning' | 'critical';
  unit?:     string;
}

interface AlertBannerProps {
  alerts: AlertItem[];
}

const LABELS: Record<string, string> = {
  taux_occupation:         'Taux d\'occupation',
  budget_realise:          'Budget réalisé',
  taux_absenteisme:        'Taux d\'absentéisme',
  evenements_indesirables: 'Événements indésirables',
};

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  const hasCritical = alerts.some(a => a.severity === 'critical');

  const borderColor = hasCritical ? 'var(--color-danger)'  : 'var(--color-warning)';
  const bgColor     = hasCritical ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)';
  const textColor   = hasCritical ? 'var(--color-danger)'  : 'var(--color-warning)';
  const Icon        = hasCritical ? XCircle : AlertTriangle;

  return (
    <div
      role="alert"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      {/* Icon */}
      <div style={{ color: textColor, flexShrink: 0, marginTop: '1px' }}>
        <Icon size={16} strokeWidth={2} />
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <p style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: 600,
          color: textColor,
          fontFamily: 'var(--font-sans)',
          marginBottom: alerts.length > 1 ? '6px' : 0,
        }}>
          {hasCritical ? 'Alerte critique' : 'Attention'} — {alerts.length} indicateur{alerts.length > 1 ? 's' : ''} hors seuil
        </p>

        {alerts.length > 1 && (
          <ul style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}>
            {alerts.map((alert) => (
              <li key={alert.indicator} style={{
                fontSize: '12px',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: alert.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)',
                  flexShrink: 0,
                }} />
                <strong style={{ fontWeight: 600 }}>
                  {LABELS[alert.indicator] ?? alert.indicator}
                </strong>
                {': '}
                <span>
                  {alert.value}{alert.unit ?? '%'}
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  (seuil : {alert.threshold}{alert.unit ?? '%'})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
