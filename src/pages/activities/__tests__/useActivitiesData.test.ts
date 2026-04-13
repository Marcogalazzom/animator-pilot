import { describe, it, expect } from 'vitest';
import { bucketize, splitPast, type Activity } from '../useActivitiesData';

function act(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1, title: 'X', activity_type: 'jeux', description: '',
    date: '2026-04-15', time_start: '14:00', time_end: null, location: 'A',
    max_participants: 10, actual_participants: 0, animator_name: '',
    status: 'planned', materials_needed: '', notes: '',
    linked_project_id: null, is_shared: 1, is_template: 0,
    synced_from: '', last_sync_at: null, external_id: null, created_at: '',
    ...overrides,
  };
}

describe('bucketize', () => {
  it('regroupe les activités à venir par bucket', () => {
    const today = '2026-04-15';
    const items = [
      act({ id: 1, date: '2026-04-15' }),                         // today
      act({ id: 2, date: '2026-04-16' }),                         // tomorrow
      act({ id: 3, date: '2026-04-17' }),                         // this week (Friday)
      act({ id: 4, date: '2026-04-22' }),                         // next week
      act({ id: 5, date: '2026-05-15' }),                         // later
    ];
    const result = bucketize(items, today);
    expect(result["Aujourd'hui"].map((a) => a.id)).toEqual([1]);
    expect(result['Demain'].map((a) => a.id)).toEqual([2]);
    expect(result['Cette semaine'].map((a) => a.id)).toEqual([3]);
    expect(result['La semaine prochaine'].map((a) => a.id)).toEqual([4]);
    expect(result['Plus tard'].map((a) => a.id)).toEqual([5]);
  });
});

describe('splitPast', () => {
  it('range les passées en À confirmer / Terminées / Annulées', () => {
    const today = '2026-04-15';
    const items = [
      act({ id: 1, date: '2026-04-10', status: 'planned' }),    // À confirmer
      act({ id: 2, date: '2026-04-11', status: 'completed' }),  // Terminée
      act({ id: 3, date: '2026-04-12', status: 'cancelled' }),  // Annulée
      act({ id: 4, date: '2026-04-14', status: 'planned' }),    // À confirmer
    ];
    const { toConfirm, completed, cancelled } = splitPast(items, today);
    expect(toConfirm.map((a) => a.id)).toEqual([4, 1]);
    expect(completed.map((a) => a.id)).toEqual([2]);
    expect(cancelled.map((a) => a.id)).toEqual([3]);
  });
});
