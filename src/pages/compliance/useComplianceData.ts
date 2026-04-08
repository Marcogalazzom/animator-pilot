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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_OBLIGATIONS: ComplianceObligation[] = [
  {
    id: 1,
    title: 'Rapport d\'activité annuel',
    category: 'governance',
    frequency: 'annual',
    description: 'Rapport annuel transmis à l\'ARS et au Conseil Départemental.',
    status: 'compliant',
    next_due_date: '2026-12-31',
    last_validated_date: '2026-01-15',
    document_path: '/docs/rapport-2025.pdf',
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 2,
    title: 'Contrat Pluriannuel d\'Objectifs (CPOM)',
    category: 'governance',
    frequency: 'quinquennial',
    description: 'Renouvellement et suivi du CPOM avec les autorités de tutelle.',
    status: 'in_progress',
    next_due_date: '2026-06-30',
    last_validated_date: null,
    document_path: null,
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 3,
    title: 'Évaluation externe HAS',
    category: 'quality',
    frequency: 'quinquennial',
    description: 'Évaluation externe de la qualité des prestations par organisme agréé.',
    status: 'to_plan',
    next_due_date: '2027-03-31',
    last_validated_date: null,
    document_path: null,
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 4,
    title: 'Formation obligatoire gestes barrières',
    category: 'hr',
    frequency: 'annual',
    description: 'Formation de l\'ensemble du personnel aux gestes barrières.',
    status: 'non_compliant',
    next_due_date: '2026-02-28',
    last_validated_date: null,
    document_path: null,
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 5,
    title: 'Contrôle sécurité incendie',
    category: 'security',
    frequency: 'annual',
    description: 'Vérification annuelle des équipements de lutte contre l\'incendie.',
    status: 'compliant',
    next_due_date: '2026-11-30',
    last_validated_date: '2025-11-28',
    document_path: '/docs/controle-incendie-2025.pdf',
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 6,
    title: 'Registre des accidents du travail',
    category: 'hr',
    frequency: 'permanent',
    description: 'Tenue à jour du registre des accidents du travail et maladies professionnelles.',
    status: 'in_progress',
    next_due_date: null,
    last_validated_date: null,
    document_path: null,
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 7,
    title: 'Plan de maîtrise sanitaire',
    category: 'quality',
    frequency: 'annual',
    description: 'Révision annuelle du plan de maîtrise sanitaire et protocoles HACCP.',
    status: 'compliant',
    next_due_date: '2026-09-30',
    last_validated_date: '2025-09-15',
    document_path: null,
    is_builtin: 1,
    created_at: '2025-01-01',
  },
  {
    id: 8,
    title: 'Formation droits des résidents',
    category: 'hr',
    frequency: 'annual',
    description: 'Formation annuelle sur les droits et libertés des personnes accueillies.',
    status: 'to_plan',
    next_due_date: '2026-05-31',
    last_validated_date: null,
    document_path: null,
    is_builtin: 1,
    created_at: '2025-01-01',
  },
];

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
      if (data.length === 0) {
        setObligations(MOCK_OBLIGATIONS);
        setStats(computeStats(MOCK_OBLIGATIONS));
      } else {
        setObligations(data);
        setStats(dbStats);
      }
    } catch (err) {
      setError(String(err));
      setObligations(MOCK_OBLIGATIONS);
      setStats(computeStats(MOCK_OBLIGATIONS));
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
