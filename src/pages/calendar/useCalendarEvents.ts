import { useState, useEffect } from 'react';
import { getProjects } from '@/db';
import { getActivities } from '@/db/activities';
import type { Activity, Project } from '@/db/types';

export type CalendarSource = 'activity' | 'project';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  time: string | null;     // HH:MM (null pour les projects)
  type: string;            // activity_type ou 'project'
  location: string;
  animator: string;
  status: string;
  source: CalendarSource;
  link: string;
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

  return events.sort(compareEvents);
}

export function byDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.date === date).sort(compareEvents);
}

export function byWeek(
  events: CalendarEvent[],
  mondayDate: string,
): Record<string, CalendarEvent[]> {
  // Parse as UTC to avoid timezone-induced off-by-one in toIso()
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
        const [activities, projects] = await Promise.all([
          getActivities().catch(() => [] as Activity[]),
          getProjects().catch(() => [] as Project[]),
        ]);
        if (cancelled) return;
        setEvents(buildEventsFromDb(activities, projects));
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
