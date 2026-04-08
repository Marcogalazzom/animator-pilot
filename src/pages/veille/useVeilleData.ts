import { useState, useEffect, useCallback } from 'react';
import { getWatchItems, createWatchItem, updateWatchItem, deleteWatchItem, getTrainings, createTraining, updateTraining, deleteTraining } from '@/db';
import type { RegulatoryWatch, WatchCategory, TrainingTracking } from '@/db/types';

export const WATCH_LABELS: Record<string, string> = {
  legislation: 'Législation', has_recommendation: 'Recommandations HAS',
  ars_circular: 'Circulaires ARS', formation: 'Formation', other: 'Autre',
};
export const WATCH_COLORS: Record<string, string> = {
  legislation: 'var(--color-primary)', has_recommendation: 'var(--color-warning)',
  ars_circular: 'var(--color-success)', formation: 'var(--color-text-secondary)', other: 'var(--color-border)',
};
export const TRAINING_LABELS: Record<string, string> = {
  securite: 'Sécurité', soins: 'Soins', management: 'Management', other: 'Autre',
};

export interface VeilleData {
  items: RegulatoryWatch[];
  trainings: TrainingTracking[];
  loading: boolean;
  filterCategory: WatchCategory | null;
  setFilterCategory: (c: WatchCategory | null) => void;
  filterRead: boolean | null;
  setFilterRead: (r: boolean | null) => void;
  trainingYear: number;
  setTrainingYear: (y: number) => void;
  refresh: () => void;
  addItem: (item: Omit<RegulatoryWatch, 'id' | 'created_at'>) => Promise<number>;
  editItem: (id: number, u: Partial<RegulatoryWatch>) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  addTraining: (t: Omit<TrainingTracking, 'id' | 'created_at'>) => Promise<number>;
  editTraining: (id: number, u: Partial<TrainingTracking>) => Promise<void>;
  removeTraining: (id: number) => Promise<void>;
}

export function useVeilleData(): VeilleData {
  const [items, setItems] = useState<RegulatoryWatch[]>([]);
  const [trainings, setTrainings] = useState<TrainingTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<WatchCategory | null>(null);
  const [filterRead, setFilterRead] = useState<boolean | null>(null);
  const [trainingYear, setTrainingYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbItems, dbTrainings] = await Promise.all([
        getWatchItems(filterCategory ?? undefined, filterRead ?? undefined).catch(() => []),
        getTrainings(trainingYear).catch(() => []),
      ]);
      setItems(dbItems as RegulatoryWatch[]);
      setTrainings(dbTrainings as TrainingTracking[]);
    } finally { setLoading(false); }
  }, [filterCategory, filterRead, trainingYear]);

  useEffect(() => { loadData(); }, [loadData]);

  return {
    items, trainings, loading,
    filterCategory, setFilterCategory, filterRead, setFilterRead,
    trainingYear, setTrainingYear,
    refresh: loadData,
    addItem: async (i) => { const id = await createWatchItem(i); await loadData(); return id; },
    editItem: async (id, u) => { await updateWatchItem(id, u); await loadData(); },
    removeItem: async (id) => { await deleteWatchItem(id); await loadData(); },
    addTraining: async (t) => { const id = await createTraining(t); await loadData(); return id; },
    editTraining: async (id, u) => { await updateTraining(id, u); await loadData(); },
    removeTraining: async (id) => { await deleteTraining(id); await loadData(); },
  };
}
