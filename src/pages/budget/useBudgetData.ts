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

// ─── Mock data ───────────────────────────────────────────────

const MOCK_BUDGET: AnimationBudget = {
  id: 1, fiscal_year: new Date().getFullYear(), total_allocated: 15000,
  synced_from: '', last_sync_at: null, external_id: null, created_at: '',
};

const today = new Date();
const addDays = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n).toISOString().slice(0, 10);

const MOCK_EXPENSES: Expense[] = [
  { id: 1, fiscal_year: today.getFullYear(), title: 'Musicothérapeute - Mars', category: 'intervenants', amount: 320, date: addDays(-20), description: '2 séances musicothérapie', supplier: 'Marie Martin', invoice_path: null, linked_intervenant_id: null, synced_from: '', last_sync_at: null, external_id: null, created_at: '' },
  { id: 2, fiscal_year: today.getFullYear(), title: 'Peinture et pinceaux', category: 'materiel', amount: 85.50, date: addDays(-15), description: 'Lot peinture acrylique + pinceaux', supplier: 'Cultura', invoice_path: null, linked_intervenant_id: null, synced_from: '', last_sync_at: null, external_id: null, created_at: '' },
  { id: 3, fiscal_year: today.getFullYear(), title: 'Sortie Jardin Botanique', category: 'sorties', amount: 180, date: addDays(-10), description: 'Bus + entrées pour 12 résidents', supplier: 'Transport Express', invoice_path: null, linked_intervenant_id: null, synced_from: '', last_sync_at: null, external_id: null, created_at: '' },
  { id: 4, fiscal_year: today.getFullYear(), title: 'Goûter anniversaires Mars', category: 'fetes', amount: 45, date: addDays(-8), description: 'Gâteau + boissons', supplier: 'Boulangerie Petit', invoice_path: null, linked_intervenant_id: null, synced_from: '', last_sync_at: null, external_id: null, created_at: '' },
  { id: 5, fiscal_year: today.getFullYear(), title: 'Art-thérapeute - Avril', category: 'intervenants', amount: 250, date: addDays(-3), description: '1 séance atelier créatif', supplier: 'Sophie Duval', invoice_path: null, linked_intervenant_id: null, synced_from: '', last_sync_at: null, external_id: null, created_at: '' },
  { id: 6, fiscal_year: today.getFullYear(), title: 'Jeux de société', category: 'materiel', amount: 62, date: addDays(-1), description: '3 jeux adaptés personnes âgées', supplier: 'Amazon', invoice_path: null, linked_intervenant_id: null, synced_from: '', last_sync_at: null, external_id: null, created_at: '' },
];

const MOCK_SUMMARY: ExpenseSummary = {
  total: 942.50, count: 6,
  byCategory: { intervenants: 570, materiel: 147.50, sorties: 180, fetes: 45, other: 0 },
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
  const [budget, setBudget] = useState<AnimationBudget | null>(MOCK_BUDGET);
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [summary, setSummary] = useState<ExpenseSummary>(MOCK_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncStatus = useSyncStore((s) => s.modules.budget.status);

  const loadData = useCallback(async () => {
    try {
      const [dbBudget, dbExpenses, dbSummary] = await Promise.all([
        getBudget(year).catch(() => null),
        getExpenses(year).catch(() => [] as Expense[]),
        getExpenseSummary(year).catch(() => MOCK_SUMMARY),
      ]);

      if (dbBudget) setBudget(dbBudget);
      if (dbExpenses.length > 0) setExpenses(dbExpenses);
      setSummary(dbSummary.count > 0 ? dbSummary : MOCK_SUMMARY);
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
