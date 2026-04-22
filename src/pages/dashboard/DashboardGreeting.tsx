import { useMemo } from 'react';
import { Download } from 'lucide-react';

import { useNow } from '@/hooks/useNow';
import { useWeather } from '@/hooks/useWeather';
import { buildGreeting } from './greeting';
import type { CalendarEvent } from '../calendar/useCalendarEvents';

const DAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatEyebrowDate(d: Date): string {
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR[d.getMonth()]}`.toUpperCase();
}

interface DashboardGreetingProps {
  firstName: string;
  todayEvents: CalendarEvent[];
  todayBirthdayNames: string[];
  onExport: () => void;
  exporting: boolean;
}

export default function DashboardGreeting({
  firstName,
  todayEvents,
  todayBirthdayNames,
  onExport,
  exporting,
}: DashboardGreetingProps) {
  const now = useNow();
  const weather = useWeather();

  const content = useMemo(
    () => buildGreeting({ now, firstName, events: todayEvents, todayBirthdayNames, weather }),
    [now, firstName, todayEvents, todayBirthdayNames, weather],
  );

  const eyebrowText = formatEyebrowDate(now);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 280 }}>

        {/* Eyebrow : date · météo (si dispo) */}
        <div
          className="eyebrow"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <span>{eyebrowText}</span>
          {weather && (
            <>
              <span style={{ opacity: 0.45 }}>·</span>
              <span
                aria-hidden
                style={{ fontSize: 13, lineHeight: 1, color: 'var(--terra)' }}
              >
                {weather.icon}
              </span>
              <span>{Math.round(weather.tempC)}°</span>
            </>
          )}
        </div>

        {/* Hello — serif, grande taille */}
        <div
          className="serif"
          style={{
            fontSize: 34, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.1,
            color: 'var(--ink)',
          }}
        >
          {content.hello}
        </div>

        {/* Phrase de contexte (+ phrase météo si remarquable) */}
        <div
          style={{
            fontSize: 15, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          {content.contextLine}
          {content.weatherPhrase && (
            <>
              {' '}
              <span style={{ fontStyle: 'italic', color: 'var(--ink-4)' }}>
                {content.weatherPhrase}
              </span>
            </>
          )}
        </div>

        {/* Coda italique */}
        <div
          style={{
            fontStyle: 'italic', fontSize: 14, color: 'var(--ink-4)',
            marginTop: 14,
          }}
        >
          {content.coda}
        </div>
      </div>

      <button className="btn" onClick={onExport} disabled={exporting}>
        <Download size={13} />
        {exporting ? 'Export…' : 'Exporter le bilan'}
      </button>
    </div>
  );
}
