import { useState, useEffect, useCallback } from 'react';
import {
  getEvents, createEvent, updateEvent, deleteEvent,
  getCorrespondences, createCorrespondence, updateCorrespondence, deleteCorrespondence,
  getChecklists, createChecklistItem, updateChecklistItem, deleteChecklistItem,
} from '@/db';
import type {
  AuthorityEvent, AuthorityCorrespondence, PreparationChecklist,
  AuthorityType, EventStatus,
} from '@/db/types';

export const AUTHORITY_LABELS: Record<string, string> = {
  ars: 'ARS', cd: 'Conseil départemental', has: 'HAS', prefecture: 'Préfecture', other: 'Autre',
};
export const AUTHORITY_COLORS: Record<string, string> = {
  ars: 'var(--color-primary)', cd: 'var(--color-success)', has: 'var(--color-warning)', prefecture: 'var(--color-danger)', other: 'var(--color-text-secondary)',
};
export const EVENT_TYPE_LABELS: Record<string, string> = {
  cpom: 'CPOM', budget_campaign: 'Campagne budgétaire', evaluation: 'Évaluation', inspection: 'Inspection',
  commission: 'Commission', dialogue: 'Dialogue de gestion', other: 'Autre',
};
export const STATUS_LABELS: Record<string, string> = {
  planned: 'Planifié', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé',
};
export const CORR_TYPE_LABELS: Record<string, string> = {
  letter: 'Courrier', email: 'E-mail', meeting: 'Réunion', phone: 'Téléphone',
};
export const CORR_DIR_LABELS: Record<string, string> = {
  sent: 'Envoyé', received: 'Reçu',
};
export const CORR_STATUS_LABELS: Record<string, string> = {
  sent: 'Envoyé', received: 'Reçu', awaiting_reply: 'En attente', archived: 'Archivé',
};

export interface TutellesData {
  events: AuthorityEvent[];
  correspondences: AuthorityCorrespondence[];
  checklist: PreparationChecklist[];
  loading: boolean;
  selectedEventId: number | null;
  setSelectedEventId: (id: number | null) => void;
  filterAuthority: AuthorityType | null;
  setFilterAuthority: (a: AuthorityType | null) => void;
  filterStatus: EventStatus | null;
  setFilterStatus: (s: EventStatus | null) => void;
  refresh: () => void;
  addEvent: (e: Omit<AuthorityEvent, 'id' | 'created_at'>) => Promise<number>;
  editEvent: (id: number, u: Partial<AuthorityEvent>) => Promise<void>;
  removeEvent: (id: number) => Promise<void>;
  addCorrespondence: (c: Omit<AuthorityCorrespondence, 'id' | 'created_at'>) => Promise<number>;
  editCorrespondence: (id: number, u: Partial<AuthorityCorrespondence>) => Promise<void>;
  removeCorrespondence: (id: number) => Promise<void>;
  loadChecklist: (eventId: number) => Promise<void>;
  addCheckItem: (item: Omit<PreparationChecklist, 'id' | 'created_at'>) => Promise<number>;
  editCheckItem: (id: number, u: Partial<PreparationChecklist>) => Promise<void>;
  removeCheckItem: (id: number) => Promise<void>;
}

export function useTutellesData(): TutellesData {
  const [events, setEvents] = useState<AuthorityEvent[]>([]);
  const [correspondences, setCorrespondences] = useState<AuthorityCorrespondence[]>([]);
  const [checklist, setChecklist] = useState<PreparationChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [filterAuthority, setFilterAuthority] = useState<AuthorityType | null>(null);
  const [filterStatus, setFilterStatus] = useState<EventStatus | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbEvents, dbCorr] = await Promise.all([
        getEvents(filterAuthority ?? undefined, undefined, filterStatus ?? undefined).catch(() => []),
        getCorrespondences(filterAuthority ?? undefined).catch(() => []),
      ]);
      setEvents(dbEvents as AuthorityEvent[]);
      setCorrespondences(dbCorr as AuthorityCorrespondence[]);
    } finally {
      setLoading(false);
    }
  }, [filterAuthority, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadChecklistForEvent = useCallback(async (eventId: number) => {
    const items = await getChecklists(eventId).catch(() => []);
    setChecklist(items as PreparationChecklist[]);
  }, []);

  // Auto-load checklist when event selected
  useEffect(() => {
    if (selectedEventId) loadChecklistForEvent(selectedEventId);
    else setChecklist([]);
  }, [selectedEventId, loadChecklistForEvent]);

  return {
    events, correspondences, checklist, loading,
    selectedEventId, setSelectedEventId,
    filterAuthority, setFilterAuthority,
    filterStatus, setFilterStatus,
    refresh: loadData,
    addEvent: async (e) => { const id = await createEvent(e); await loadData(); return id; },
    editEvent: async (id, u) => { await updateEvent(id, u); await loadData(); },
    removeEvent: async (id) => { await deleteEvent(id); await loadData(); setSelectedEventId(null); },
    addCorrespondence: async (c) => { const id = await createCorrespondence(c); await loadData(); return id; },
    editCorrespondence: async (id, u) => { await updateCorrespondence(id, u); await loadData(); },
    removeCorrespondence: async (id) => { await deleteCorrespondence(id); await loadData(); },
    loadChecklist: loadChecklistForEvent,
    addCheckItem: async (item) => { const id = await createChecklistItem(item); if (selectedEventId) await loadChecklistForEvent(selectedEventId); return id; },
    editCheckItem: async (id, u) => { await updateChecklistItem(id, u); if (selectedEventId) await loadChecklistForEvent(selectedEventId); },
    removeCheckItem: async (id) => { await deleteChecklistItem(id); if (selectedEventId) await loadChecklistForEvent(selectedEventId); },
  };
}
