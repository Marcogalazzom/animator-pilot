import { useState, useEffect, useCallback } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import {
  getBudget, upsertBudget, upsertCategoryLimit,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getExpenseSummary,
  getUpcomingExpenses, createUpcomingExpense, updateUpcomingExpense, deleteUpcomingExpense,
  type ExpenseSummary,
} from '@/db/budget';
import type { AnimationBudget, Expense, ExpenseCategory, UpcomingExpense } from '@/db/types';

export const DEFAULT_CATEGORY_LIMIT = 3000;

// ─── Constants ───────────────────────────────────────────────

export const CATEGORIES: Record<ExpenseCategory, { label: string; color: string; bg: string }> = {
  intervenants: { label: 'Intervenants', color: '#7C3AED', bg: '#F5F3FF' },
  materiel:     { label: 'Matériel',     color: '#1E40AF', bg: '#EFF6FF' },
  sorties:      { label: 'Sorties',      color: '#059669', bg: '#ECFDF5' },
  fetes:        { label: 'Fêtes',        color: '#DC2626', bg: '#FEF2F2' },
  other:        { label: 'Autre',        color: '#64748B', bg: '#F1F5F9' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as ExpenseCategory[];

const EMPTY_SUMMARY: ExpenseSummary = {
  total: 0, count: 0,
  byCategory: { intervenants: 0, materiel: 0, sorties: 0, fetes: 0, other: 0 },
};

// ─── Hook ────────────────────────────────────────────────────

export interface BudgetData {
  budget: AnimationBudget | null;
  expenses: Expense[];
  summary: ExpenseSummary;
  year: number;
  setYear: (y: number) => void;
  loading: boolean;
  error: string | null;
  categoryLimits: Record<ExpenseCategory, number>;
  upcomingExpenses: UpcomingExpense[];
  saveBudgetTotal: (amount: number) => Promise<void>;
  saveCategoryLimit: (category: ExpenseCategory, amount: number) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<number>;
  editExpense: (id: number, updates: Partial<Expense>) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  addUpcoming: (data: Omit<UpcomingExpense, 'id' | 'created_at'>) => Promise<void>;
  editUpcoming: (id: number, updates: Partial<Omit<UpcomingExpense, 'id' | 'created_at'>>) => Promise<void>;
  removeUpcoming: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const LIMIT_FIELD: Record<ExpenseCategory, keyof AnimationBudget> = {
  intervenants: 'limit_intervenants',
  materiel:     'limit_materiel',
  sorties:      'limit_sorties',
  fetes:        'limit_fetes',
  other:        'limit_other',
};

function computeLimits(b: AnimationBudget | null): Record<ExpenseCategory, number> {
  const out = {} as Record<ExpenseCategory, number>;
  for (const k of CATEGORY_KEYS) {
    const raw = b ? (b[LIMIT_FIELD[k]] as number | null | undefined) : undefined;
    out[k] = typeof raw === 'number' && raw >= 0 ? raw : DEFAULT_CATEGORY_LIMIT;
  }
  return out;
}

export function useBudgetData(): BudgetData {
  const [year, setYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<AnimationBudget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>(EMPTY_SUMMARY);
  const [upcomingExpenses, setUpcomingExpenses] = useState<UpcomingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncStatus = useSyncStore((s) => s.modules.budget.status);

  const loadData = useCallback(async () => {
    try {
      const [dbBudget, dbExpenses, dbSummary, dbUpcoming] = await Promise.all([
        getBudget(year).catch(() => null),
        getExpenses(year).catch(() => [] as Expense[]),
        getExpenseSummary(year).catch(() => EMPTY_SUMMARY),
        getUpcomingExpenses().catch(() => [] as UpcomingExpense[]),
      ]);

      setBudget(dbBudget);
      setExpenses(dbExpenses);
      setSummary(dbSummary);
      setUpcomingExpenses(dbUpcoming);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { loadData(); }, [loadData, syncStatus]);

  const saveBudgetTotal = useCallback(async (amount: number) => {
    await upsertBudget(year, amount).catch(() => {});
    setBudget((prev) => prev
      ? { ...prev, total_allocated: amount }
      : {
          id: 0, fiscal_year: year, total_allocated: amount,
          limit_intervenants: DEFAULT_CATEGORY_LIMIT,
          limit_materiel:     DEFAULT_CATEGORY_LIMIT,
          limit_sorties:      DEFAULT_CATEGORY_LIMIT,
          limit_fetes:        DEFAULT_CATEGORY_LIMIT,
          limit_other:        DEFAULT_CATEGORY_LIMIT,
          synced_from: '', last_sync_at: null, external_id: null, created_at: '',
        });
  }, [year]);

  const saveCategoryLimit = useCallback(async (category: ExpenseCategory, amount: number) => {
    await upsertCategoryLimit(year, category, amount).catch(() => {});
    setBudget((prev) => {
      const field = LIMIT_FIELD[category];
      if (prev) return { ...prev, [field]: amount } as AnimationBudget;
      return {
        id: 0, fiscal_year: year, total_allocated: 0,
        limit_intervenants: DEFAULT_CATEGORY_LIMIT,
        limit_materiel:     DEFAULT_CATEGORY_LIMIT,
        limit_sorties:      DEFAULT_CATEGORY_LIMIT,
        limit_fetes:        DEFAULT_CATEGORY_LIMIT,
        limit_other:        DEFAULT_CATEGORY_LIMIT,
        synced_from: '', last_sync_at: null, external_id: null, created_at: '',
        [field]: amount,
      } as AnimationBudget;
    });
  }, [year]);

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'created_at'>) => {
    const id = await createExpense(expense).catch(() => Date.now());
    setExpenses((prev) => [{ ...expense, id, created_at: new Date().toISOString() }, ...prev]);
    const newSummary = await getExpenseSummary(year).catch(() => summary);
    setSummary(newSummary);
    return id;
  }, [year, summary]);

  const editExpense = useCallback(async (id: number, updates: Partial<Expense>) => {
    await updateExpense(id, updates).catch(() => {});
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
    const newSummary = await getExpenseSummary(year).catch(() => summary);
    setSummary(newSummary);
  }, [year, summary]);

  const removeExpense = useCallback(async (id: number) => {
    await deleteExpense(id).catch(() => {});
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    const newSummary = await getExpenseSummary(year).catch(() => summary);
    setSummary(newSummary);
  }, [year, summary]);

  const addUpcoming = useCallback(async (data: Omit<UpcomingExpense, 'id' | 'created_at'>) => {
    const id = await createUpcomingExpense(data).catch(() => 0);
    if (!id) return;
    setUpcomingExpenses((prev) =>
      [...prev, { ...data, id, created_at: new Date().toISOString() }]
        .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.id - b.id)),
    );
  }, []);

  const editUpcoming = useCallback(async (
    id: number,
    updates: Partial<Omit<UpcomingExpense, 'id' | 'created_at'>>,
  ) => {
    await updateUpcomingExpense(id, updates).catch(() => {});
    setUpcomingExpenses((prev) =>
      prev
        .map((u) => (u.id === id ? { ...u, ...updates } : u))
        .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.id - b.id)),
    );
  }, []);

  const removeUpcoming = useCallback(async (id: number) => {
    await deleteUpcomingExpense(id).catch(() => {});
    setUpcomingExpenses((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const categoryLimits = computeLimits(budget);

  return {
    budget, expenses, summary, year, setYear, loading, error,
    categoryLimits,
    upcomingExpenses,
    saveBudgetTotal, saveCategoryLimit,
    addExpense, editExpense, removeExpense,
    addUpcoming, editUpcoming, removeUpcoming,
    refresh: loadData,
  };
}
