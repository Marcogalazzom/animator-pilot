import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCalendarEvents } from './calendar/useCalendarEvents';
import CalendarToolbar, { type CalendarView } from './calendar/CalendarToolbar';
import DayView from './calendar/DayView';
import WeekView from './calendar/WeekView';
import LocationView from './calendar/LocationView';
import ListView from './calendar/ListView';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';
import { todayIso, mondayOf } from './calendar/dateUtils';

const MONTH_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR[d.getMonth()].toLowerCase()}`;
}

function weekLabel(iso: string): string {
  const mon = mondayOf(iso);
  const d = new Date(mon + 'T00:00:00');
  return `Semaine du ${d.getDate()} ${MONTH_FR[d.getMonth()].toLowerCase()}`;
}

export default function Calendar() {
  const { events, loading } = useCalendarEvents();
  const [params, setParams] = useSearchParams();
  const [types, setTypes] = useState<CategoryColor[]>([]);

  const view = (params.get('view') as CalendarView) || 'day';
  const date = params.get('date') || todayIso();
  const typeFilter = params.get('type') || '';
  const locationFilter = params.get('location') || '';

  function update(p: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }

  useEffect(() => {
    if (loading) return;
    const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));
    ensureCategoryColors('activities', uniqueTypes).then(setTypes).catch(() => {});
  }, [loading, events]);

  const locations = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.location).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [events]);

  const label = view === 'week' ? weekLabel(date) : dayLabel(date);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '220px', height: '28px', borderRadius: '6px', background: 'var(--color-border)' }} className="shimmer" />
        <div style={{ width: '100%', height: '400px', borderRadius: '10px', background: 'var(--color-surface)' }} className="shimmer" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1300px' }}>
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
          margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em',
          color: 'var(--color-text-primary)',
        }}>
          Calendrier
        </h1>
        <p style={{
          fontSize: '13px', color: 'var(--color-text-secondary)',
          margin: '6px 0 0', fontFamily: 'var(--font-sans)',
        }}>
          Planning des activités, projets et créneaux par lieu
        </p>
      </div>

      <CalendarToolbar
        view={view}
        onViewChange={(v) => update({ view: v })}
        date={date}
        onDateChange={(d) => update({ date: d })}
        dateLabel={label}
        types={types}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => update({ type: v || null })}
        locations={locations}
        locationFilter={locationFilter}
        onLocationFilterChange={(v) => update({ location: v || null })}
        onToday={() => update({ date: todayIso() })}
      />

      {view === 'day' && (
        <DayView events={events} date={date} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'week' && (
        <WeekView events={events} mondayDate={mondayOf(date)} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'location' && (
        <LocationView events={events} date={date} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'list' && (
        <ListView events={events} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
    </div>
  );
}
