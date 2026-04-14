import { useState, useEffect } from 'react';
import { getProjects } from '@/db';
import { getUpcomingActivities, getActivityStats } from '@/db/activities';
import { getAppointmentStats } from '@/db/appointments';
import { getResidentCount } from '@/db/residents';
import { getInventoryStats } from '@/db/inventory';
import { getAlbumStats } from '@/db/photos';
import { getUnreadAlertCount } from '@/db/alerts';
import type { Project, Activity } from '@/db/types';

// ─── Types ────────────────────────────────────────────────────

export interface ActivityStats {
  thisMonth: number;
  totalParticipants: number;
  upcoming: number;
  completedThisYear: number;
}

export interface AppointmentStats {
  thisWeek: number;
  upcoming: number;
  completedThisMonth: number;
}

export interface DashboardData {
  activityStats:      ActivityStats;
  appointmentStats:   AppointmentStats;
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
  const [activityStats, setActivityStats]       = useState<ActivityStats>({ thisMonth: 0, totalParticipants: 0, upcoming: 0, completedThisYear: 0 });
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({ thisWeek: 0, upcoming: 0, completedThisMonth: 0 });
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([]);
  const [overdueProjects, setOverdueProjects]   = useState<Project[]>([]);
  const [residentCount, setResidentCount]       = useState(0);
  const [inventoryToReplace, setInventoryToReplace] = useState(0);
  const [albumCount, setAlbumCount]             = useState(0);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dbStats, dbAppt, dbUpcoming, dbProjects, dbResidents, dbInventory, dbAlbums, dbAlerts] = await Promise.all([
          getActivityStats().catch(() => ({ thisMonth: 0, totalParticipants: 0, upcoming: 0, completedThisYear: 0 })),
          getAppointmentStats().catch(() => ({ thisWeek: 0, upcoming: 0, completedThisMonth: 0 })),
          getUpcomingActivities(5).catch(() => [] as Activity[]),
          getProjects('overdue').catch(() => [] as Project[]),
          getResidentCount().catch(() => 0),
          getInventoryStats().catch(() => ({ total: 0, toReplace: 0, categories: 0 })),
          getAlbumStats().catch(() => ({ totalAlbums: 0, totalPhotos: 0 })),
          getUnreadAlertCount().catch(() => 0),
        ]);

        if (cancelled) return;

        setActivityStats(dbStats);
        setAppointmentStats(dbAppt);
        setUpcomingActivities(dbUpcoming);
        setOverdueProjects(dbProjects);
        setResidentCount(dbResidents);
        setInventoryToReplace(dbInventory.toReplace);
        setAlbumCount(dbAlbums.totalAlbums);
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
    appointmentStats,
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
