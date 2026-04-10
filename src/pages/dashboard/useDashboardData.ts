import { useState, useEffect } from 'react';
import { getProjects } from '@/db';
import { getUpcomingActivities, getActivityStats } from '@/db/activities';
import { getResidentCount } from '@/db/residents';
import { getInventoryStats } from '@/db/inventory';
import { getAlbumStats } from '@/db/photos';
import { getUnreadAlertCount } from '@/db/alerts';
import type { Project, Activity } from '@/db/types';

// ─── Mock data (realistic animation data) ───────────────────

const today = new Date();
const addDays = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n).toISOString().slice(0, 10);

export const MOCK_ACTIVITY_STATS = {
  thisMonth: 18,
  totalParticipants: 245,
  upcoming: 6,
  completedThisYear: 89,
};

export const MOCK_UPCOMING_ACTIVITIES: Activity[] = [
  { id: 1, title: 'Atelier peinture aquarelle', activity_type: 'atelier_creatif', description: '', date: addDays(1), time_start: '10:00', time_end: '11:30', location: 'Salle animation', max_participants: 12, actual_participants: 0, animator_name: 'Marie Dupont', status: 'planned', materials_needed: '', notes: '', linked_project_id: null, created_at: '' },
  { id: 2, title: 'Loto musical', activity_type: 'jeux', description: '', date: addDays(2), time_start: '14:30', time_end: '16:00', location: 'Salle polyvalente', max_participants: 30, actual_participants: 0, animator_name: 'Marie Dupont', status: 'planned', materials_needed: '', notes: '', linked_project_id: null, created_at: '' },
  { id: 3, title: 'Gym douce', activity_type: 'sport', description: '', date: addDays(3), time_start: '09:30', time_end: '10:30', location: 'Salle de gym', max_participants: 15, actual_participants: 0, animator_name: 'Claire Moreau', status: 'planned', materials_needed: '', notes: '', linked_project_id: null, created_at: '' },
  { id: 4, title: 'Concert chorale école primaire', activity_type: 'intergenerationnel', description: '', date: addDays(7), time_start: '14:00', time_end: '15:30', location: 'Hall d\'accueil', max_participants: 50, actual_participants: 0, animator_name: 'Marie Dupont', status: 'planned', materials_needed: '', notes: '', linked_project_id: null, created_at: '' },
  { id: 5, title: 'Fête des anniversaires — Avril', activity_type: 'fete', description: '', date: addDays(10), time_start: '15:00', time_end: '17:00', location: 'Salle polyvalente', max_participants: 40, actual_participants: 0, animator_name: 'Marie Dupont', status: 'planned', materials_needed: '', notes: '', linked_project_id: null, created_at: '' },
];

export const MOCK_OVERDUE_PROJECTS: Project[] = [
  {
    id: 1,
    title: 'Programme animations été 2026',
    description: '',
    owner_role: 'Animatrice',
    status: 'overdue',
    start_date: '2026-02-01',
    due_date: '2026-03-31',
    created_at: '2026-02-01',
  },
];

// ─── Types ────────────────────────────────────────────────────

export interface ActivityStats {
  thisMonth: number;
  totalParticipants: number;
  upcoming: number;
  completedThisYear: number;
}

export interface DashboardData {
  activityStats:      ActivityStats;
  upcomingActivities: Activity[];
  overdueProjects:    Project[];
  residentCount:      number;
  inventoryToReplace: number;
  albumCount:         number;
  unreadAlertCount:   number;
  loading:            boolean;
  error:              string | null;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useDashboardData(): DashboardData {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [activityStats, setActivityStats]       = useState<ActivityStats>(MOCK_ACTIVITY_STATS);
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>(MOCK_UPCOMING_ACTIVITIES);
  const [overdueProjects, setOverdueProjects]   = useState<Project[]>(MOCK_OVERDUE_PROJECTS);
  const [residentCount, setResidentCount]       = useState(42);
  const [inventoryToReplace, setInventoryToReplace] = useState(3);
  const [albumCount, setAlbumCount]             = useState(6);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dbStats, dbUpcoming, dbProjects, dbResidents, dbInventory, dbAlbums, dbAlerts] = await Promise.all([
          getActivityStats().catch(() => MOCK_ACTIVITY_STATS),
          getUpcomingActivities(5).catch(() => [] as Activity[]),
          getProjects('overdue').catch(() => [] as Project[]),
          getResidentCount().catch(() => 0),
          getInventoryStats().catch(() => ({ total: 0, toReplace: 0, categories: 0 })),
          getAlbumStats().catch(() => ({ totalAlbums: 0, totalPhotos: 0 })),
          getUnreadAlertCount().catch(() => 0),
        ]);

        if (cancelled) return;

        setActivityStats(dbStats);
        if (dbUpcoming.length > 0) setUpcomingActivities(dbUpcoming);
        if (dbProjects.length > 0) setOverdueProjects(dbProjects);
        if (dbResidents > 0) setResidentCount(dbResidents);
        if (dbInventory.toReplace > 0) setInventoryToReplace(dbInventory.toReplace);
        if (dbAlbums.totalAlbums > 0) setAlbumCount(dbAlbums.totalAlbums);
        setUnreadAlertCount(dbAlerts);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return {
    activityStats,
    upcomingActivities,
    overdueProjects,
    residentCount,
    inventoryToReplace,
    albumCount,
    unreadAlertCount,
    loading,
    error,
  };
}
