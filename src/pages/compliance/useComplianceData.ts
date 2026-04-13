import { useState, useEffect, useCallback } from 'react';
import {
  getObligations,
  getObligationStats,
  createObligation as dbCreateObligation,
  updateObligation as dbUpdateObligation,
  deleteObligation as dbDeleteObligation,
} from '@/db';
import type {
  ComplianceObligation,
  ObligationCategory,
  ObligationStatus,
} from '@/db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObligationStats {
  total: number;
  compliant: number;
  overdue: number;
  upcoming30: number;
}

export interface ComplianceFilters {
  category: ObligationCategory | '';
  status: ObligationStatus | '';
  dueRange: '' | '30' | '60' | '90';
}

export interface ComplianceData {
  obligations: ComplianceObligation[];
  filteredObligations: ComplianceObligation[];
  stats: ObligationStats;
  loading: boolean;
  error: string | null;
  filters: ComplianceFilters;
  setFilters: (f: ComplianceFilters) => void;
  selectedObligation: ComplianceObligation | null;
  selectObligation: (o: ComplianceObligation | null) => void;
  refresh: () => Promise<void>;
  createObligation: (data: Omit<ComplianceObligation, 'id' | 'created_at'>) => Promise<void>;
  updateObligation: (id: number, updates: Partial<ComplianceObligation>) => Promise<void>;
  deleteObligation: (id: number) => Promise<void>;
  markCompliant: (id: number) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyFilters(
  obligations: ComplianceObligation[],
  filters: ComplianceFilters
): ComplianceObligation[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return obligations.filter((o) => {
    if (filters.category && o.category !== filters.category) return false;
    if (filters.status && o.status !== filters.status) return false;
    if (filters.dueRange && o.next_due_date) {
      const due = new Date(o.next_due_date);
      const days = parseInt(filters.dueRange, 10);
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() + days);
      if (due > cutoff || due < today) return false;
    } else if (filters.dueRange) {
      return false; // no due date but filter requires one
    }
    return true;
  });
}

function computeStats(obligations: ComplianceObligation[]): ObligationStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  return {
    total: obligations.length,
    compliant: obligations.filter((o) => o.status === 'compliant').length,
    overdue: obligations.filter((o) => {
      if (!o.next_due_date || o.status === 'compliant') return false;
      return new Date(o.next_due_date) < today;
    }).length,
    upcoming30: obligations.filter((o) => {
      if (!o.next_due_date || o.status === 'compliant') return false;
      const due = new Date(o.next_due_date);
      return due >= today && due <= in30;
    }).length,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useComplianceData(): ComplianceData {
  const [obligations, setObligations]   = useState<ComplianceObligation[]>([]);
  const [stats, setStats]               = useState<ObligationStats>({ total: 0, compliant: 0, overdue: 0, upcoming30: 0 });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<ComplianceObligation | null>(null);
  const [filters, setFilters]           = useState<ComplianceFilters>({
    category: '',
    status: '',
    dueRange: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, dbStats] = await Promise.all([
        getObligations(),
        getObligationStats(),
      ]);
      setObligations(data);
      setStats(dbStats);
    } catch (err) {
      setError(String(err));
      setObligations([]);
      setStats({ total: 0, compliant: 0, overdue: 0, upcoming30: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredObligations = applyFilters(obligations, filters);

  const selectObligation = useCallback((o: ComplianceObligation | null) => {
    setSelectedObligation(o);
  }, []);

  const createObligation = useCallback(async (data: Omit<ComplianceObligation, 'id' | 'created_at'>) => {
    await dbCreateObligation(data);
    await loadData();
  }, [loadData]);

  const updateObligation = useCallback(async (id: number, updates: Partial<ComplianceObligation>) => {
    await dbUpdateObligation(id, updates);
    setObligations((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    setSelectedObligation((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
    // Recompute stats locally
    setObligations((prev) => {
      setStats(computeStats(prev));
      return prev;
    });
  }, []);

  const deleteObligation = useCallback(async (id: number) => {
    await dbDeleteObligation(id);
    setObligations((prev) => {
      const next = prev.filter((o) => o.id !== id);
      setStats(computeStats(next));
      return next;
    });
    if (selectedObligation?.id === id) setSelectedObligation(null);
  }, [selectedObligation]);

  const markCompliant = useCallback(async (id: number) => {
    const today = new Date().toISOString().split('T')[0];
    await dbUpdateObligation(id, { status: 'compliant', last_validated_date: today });
    setObligations((prev) => {
      const next = prev.map((o) =>
        o.id === id ? { ...o, status: 'compliant' as ObligationStatus, last_validated_date: today } : o
      );
      setStats(computeStats(next));
      return next;
    });
    setSelectedObligation((prev) =>
      prev?.id === id ? { ...prev, status: 'compliant', last_validated_date: today } : prev
    );
  }, []);

  return {
    obligations,
    filteredObligations,
    stats,
    loading,
    error,
    filters,
    setFilters,
    selectedObligation,
    selectObligation,
    refresh: loadData,
    createObligation,
    updateObligation,
    deleteObligation,
    markCompliant,
  };
}
