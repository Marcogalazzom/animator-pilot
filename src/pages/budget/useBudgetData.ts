import { useState, useEffect, useCallback } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import {
  getBudget, upsertBudget,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getExpenseSummary,
  type ExpenseSummary,
} from '@/db/budget';
import type { AnimationBudget, Expense, ExpenseCategory } from '@/db/types';

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
  saveBudgetTotal: (amount: number) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<number>;
  editExpense: (id: number, updates: Partial<Expense>) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useBudgetData(): BudgetData {
  const [year, setYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<AnimationBudget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncStatus = useSyncStore((s) => s.modules.budget.status);

  const loadData = useCallback(async () => {
    try {
      const [dbBudget, dbExpenses, dbSummary] = await Promise.all([
        getBudget(year).catch(() => null),
        getExpenses(year).catch(() => [] as Expense[]),
        getExpenseSummary(year).catch(() => EMPTY_SUMMARY),
      ]);

      setBudget(dbBudget);
      setExpenses(dbExpenses);
      setSummary(dbSummary);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { loadData(); }, [loadData, syncStatus]);

  const saveBudgetTotal = useCallback(async (amount: number) => {
    await upsertBudget(year, amount).catch(() => {});
    setBudget((prev) => prev ? { ...prev, total_allocated: amount } : { id: 0, fiscal_year: year, total_allocated: amount, synced_from: '', last_sync_at: null, external_id: null, created_at: '' });
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

  return { budget, expenses, summary, year, setYear, loading, error, saveBudgetTotal, addExpense, editExpense, removeExpense, refresh: loadData };
}
