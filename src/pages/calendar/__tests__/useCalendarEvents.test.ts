import { describe, it, expect } from 'vitest';
import {
  buildEventsFromDb,
  byDay, byWeek, byLocation, upcoming,
  type CalendarEvent,
} from '../useCalendarEvents';
import type { Activity, Project } from '@/db/types';

function evt(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'a-1',
    title: 'Test',
    date: '2026-04-15',
    time: '14:00',
    type: 'jeux',
    location: 'Étage 1',
    animator: '',
    status: 'planned',
    source: 'activity',
    link: '/activities',
    ...overrides,
  };
}

describe('byDay', () => {
  it('filtre et trie par time ASC', () => {
    const events = [
      evt({ id: '1', time: '15:00' }),
      evt({ id: '2', time: '10:30' }),
      evt({ id: '3', date: '2026-04-16', time: '09:00' }),
      evt({ id: '4', time: null }),
    ];
    const result = byDay(events, '2026-04-15');
    expect(result.map((e) => e.id)).toEqual(['4', '2', '1']);
  });
});

describe('byWeek', () => {
  it('groupe par date (YYYY-MM-DD) pour 7 jours à partir du lundi', () => {
    const events = [
      evt({ date: '2026-04-13' }),
      evt({ date: '2026-04-15' }),
      evt({ date: '2026-04-15' }),
      evt({ date: '2026-04-20' }),
    ];
    const result = byWeek(events, '2026-04-13');
    expect(Object.keys(result)).toEqual([
      '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16',
      '2026-04-17', '2026-04-18', '2026-04-19',
    ]);
    expect(result['2026-04-15']).toHaveLength(2);
    expect(result['2026-04-20']).toBeUndefined();
  });
});

describe('byLocation', () => {
  it('groupe par location pour un jour donné, trié par time', () => {
    const events = [
      evt({ id: '1', location: 'PASA',    time: '15:00' }),
      evt({ id: '2', location: 'Étage 1', time: '14:30' }),
      evt({ id: '3', location: 'PASA',    time: '10:30' }),
    ];
    const result = byLocation(events, '2026-04-15');
    expect(Object.keys(result).sort()).toEqual(['PASA', 'Étage 1'].sort());
    expect(result['PASA'].map((e) => e.id)).toEqual(['3', '1']);
  });
});

describe('upcoming', () => {
  it('limite et filtre les dates >= fromDate, trie chronologique', () => {
    const events = [
      evt({ id: '1', date: '2026-04-14' }),
      evt({ id: '2', date: '2026-04-15', time: '14:00' }),
      evt({ id: '3', date: '2026-04-15', time: '10:30' }),
      evt({ id: '4', date: '2026-04-16' }),
      evt({ id: '5', date: '2026-04-17' }),
    ];
    const result = upcoming(events, '2026-04-15', 3);
    expect(result.map((e) => e.id)).toEqual(['3', '2', '4']);
  });
});

describe('buildEventsFromDb', () => {
  it('fusionne activities et projects en événements triés', () => {
    const activities = [{
      id: 1, title: 'Yoga', activity_type: 'bien_etre', description: '',
      date: '2026-04-15', time_start: '14:30', time_end: null, location: 'Étage 1',
      max_participants: 0, actual_participants: 0, animator_name: 'Nom',
      status: 'planned', materials_needed: '', notes: '',
      linked_project_id: null, synced_from: '', last_sync_at: null,
      external_id: null, is_shared: 1, created_at: '2026-04-15',
    }] as Activity[];
    const projects = [{
      id: 2, title: 'Bilan', status: 'in_progress', description: '',
      due_date: '2026-04-20', priority: 'high', category: '',
      progress: 0, assigned_to: '', created_at: '2026-04-01',
    }] as unknown as Project[];
    const events = buildEventsFromDb(activities, projects);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Yoga');
    expect(events[0].source).toBe('activity');
    expect(events[1].source).toBe('project');
  });
});
