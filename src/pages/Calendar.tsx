import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCalendarEvents, type CalendarEvent } from './calendar/useCalendarEvents';
import CalendarToolbar, { type CalendarView } from './calendar/CalendarToolbar';
import DayView from './calendar/DayView';
import WeekView from './calendar/WeekView';
import LocationView from './calendar/LocationView';
import ListView from './calendar/ListView';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';
import { todayIso, mondayOf } from '@/utils/dateUtils';

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
  const showAppointments = params.get('showAppointments') !== '0';

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
    // Types activités uniquement (les RDV ont une couleur violette fixe)
    const uniqueTypes = Array.from(new Set(
      events.filter((e) => e.source !== 'appointment').map((e) => e.type)
    ));
    ensureCategoryColors('activities', uniqueTypes).then(setTypes).catch(() => {});
  }, [loading, events]);

  const visibleEvents = useMemo<CalendarEvent[]>(() => {
    if (showAppointments) return events;
    return events.filter((e) => e.source !== 'appointment');
  }, [events, showAppointments]);

  const locations = useMemo(() => {
    return Array.from(new Set(visibleEvents.map((e) => e.location).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [visibleEvents]);

  const label = view === 'week' ? weekLabel(date) : dayLabel(date);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ height: 44 }} />
        <div className="card" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1300, animation: 'slide-in 0.22s ease-out' }}>
      <div className="eyebrow">Planning des activités, projets et créneaux par lieu</div>

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
        showAppointments={showAppointments}
        onShowAppointmentsChange={(v) => update({ showAppointments: v ? null : '0' })}
        onToday={() => update({ date: todayIso() })}
      />

      {view === 'day' && (
        <DayView events={visibleEvents} date={date} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'week' && (
        <WeekView events={visibleEvents} mondayDate={mondayOf(date)} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'location' && (
        <LocationView events={visibleEvents} date={date} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'list' && (
        <ListView events={visibleEvents} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
    </div>
  );
}
