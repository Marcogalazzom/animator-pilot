import { useState, useEffect } from 'react';
import { getProjects } from '@/db';
import { getActivities } from '@/db/activities';
import { getAppointments } from '@/db/appointments';
import type { Activity, Appointment, Project } from '@/db/types';
import type { CategoryColor } from '@/db/categoryColors';
import { autoColor } from '@/db/categoryColors';

export type CalendarSource = 'activity' | 'project' | 'appointment';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  time: string | null;     // HH:MM (null pour les projects)
  type: string;            // activity_type, appointment_type ou 'project'
  location: string;
  animator: string;
  status: string;
  source: CalendarSource;
  link: string;
}

// Couleur violette dédiée aux rendez-vous — stable à travers les vues
export const APPOINTMENT_COLOR: CategoryColor = {
  module: 'appointments',
  name: '__appointment__',
  color: '#7C3AED',
  bg: '#F3EEFF',
  label: 'Rendez-vous',
};

// Résout la couleur pour un événement calendrier — violet fixe pour les RDV,
// sinon lookup dans les catégories activités.
export function resolveEventColor(
  e: CalendarEvent,
  typeMap: Map<string, CategoryColor>,
): CategoryColor {
  if (e.source === 'appointment') return APPOINTMENT_COLOR;
  return typeMap.get(e.type) ?? {
    module: 'activities', name: e.type, ...autoColor(e.type), label: null,
  };
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const at = a.time ?? '';
  const bt = b.time ?? '';
  if (at !== bt) return at.localeCompare(bt);
  return a.title.localeCompare(b.title);
}

export function buildEventsFromDb(
  activities: Activity[],
  projects: Project[],
  appointments: Appointment[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const a of activities) {
    if (a.status === 'cancelled') continue;
    const d = parseDate(a.date);
    if (!d) continue;
    events.push({
      id: `a-${a.id}`,
      title: a.title,
      date: toIso(d),
      time: a.time_start || null,
      type: a.activity_type,
      location: a.location ?? '',
      animator: a.animator_name ?? '',
      status: a.status,
      source: 'activity',
      link: '/activities',
    });
  }

  for (const p of projects) {
    if (p.status === 'done') continue;
    const d = parseDate(p.due_date);
    if (!d) continue;
    events.push({
      id: `p-${p.id}`,
      title: p.title,
      date: toIso(d),
      time: null,
      type: 'project',
      location: '',
      animator: '',
      status: p.status,
      source: 'project',
      link: '/projects',
    });
  }

  for (const r of appointments) {
    if (r.status === 'cancelled') continue;
    const d = parseDate(r.date);
    if (!d) continue;
    events.push({
      id: `r-${r.id}`,
      title: r.title,
      date: toIso(d),
      time: r.time_start || null,
      type: r.appointment_type,
      location: r.location ?? '',
      animator: r.participants ?? '',
      status: r.status,
      source: 'appointment',
      link: '/appointments',
    });
  }

  return events.sort(compareEvents);
}

export function byDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.date === date).sort(compareEvents);
}

export function byWeek(
  events: CalendarEvent[],
  mondayDate: string,
): Record<string, CalendarEvent[]> {
  const [y, m, day] = mondayDate.split('-').map(Number);
  const result: Record<string, CalendarEvent[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(y, m - 1, day + i));
    result[toIso(d)] = [];
  }
  for (const e of events) {
    if (e.date in result) result[e.date].push(e);
  }
  for (const k of Object.keys(result)) result[k].sort(compareEvents);
  return result;
}

export function byLocation(
  events: CalendarEvent[],
  date: string,
): Record<string, CalendarEvent[]> {
  const result: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    if (e.date !== date) continue;
    const loc = e.location || '(sans lieu)';
    if (!result[loc]) result[loc] = [];
    result[loc].push(e);
  }
  for (const k of Object.keys(result)) result[k].sort(compareEvents);
  return result;
}

export function upcoming(
  events: CalendarEvent[],
  fromDate: string,
  limit: number,
): CalendarEvent[] {
  return events.filter((e) => e.date >= fromDate).sort(compareEvents).slice(0, limit);
}

export interface CalendarData {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

export function useCalendarEvents(): CalendarData {
  const [events, setEvents]   = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [activities, projects, appointments] = await Promise.all([
          getActivities().catch(() => [] as Activity[]),
          getProjects().catch(() => [] as Project[]),
          getAppointments().catch(() => [] as Appointment[]),
        ]);
        if (cancelled) return;
        setEvents(buildEventsFromDb(activities, projects, appointments));
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { events, loading, error };
}
