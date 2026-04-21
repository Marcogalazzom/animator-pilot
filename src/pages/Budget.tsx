import { useState, useRef, useMemo } from 'react';
import {
  Plus, X, Trash2, Pencil, ChevronDown,
  Paperclip, FileText as FileIcon, Folder, Camera, Repeat,
} from 'lucide-react';

type BudgetTab = 'annual' | 'activity' | 'balance';
import { useToastStore } from '@/stores/toastStore';
import { useBudgetData, CATEGORIES, CATEGORY_KEYS } from './budget/useBudgetData';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import { uploadInvoice } from '@/services/firebase';
import type { ExpenseCategory, UpcomingExpense, UpcomingFrequency } from '@/db/types';

const CAT_CLASS: Record<ExpenseCategory, 'creative' | 'memory' | 'outing' | 'body' | 'prep'> = {
  intervenants: 'creative',
  materiel:     'memory',
  sorties:      'outing',
  fetes:        'body',
  other:        'prep',
};

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function freqLabel(freq: UpcomingFrequency): string {
  if (freq === 'weekly')  return 'hebdomadaire';
  if (freq === 'monthly') return 'mensuel';
  if (freq === 'yearly')  return 'annuel';
  return '';
}

function dueLabel(u: UpcomingExpense): string {
  const d = new Date(u.due_date);
  if (isNaN(d.getTime())) return u.due_date;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dayMonth = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;

  if (u.recurring) {
    const label = freqLabel(u.frequency);
    if (u.frequency === 'weekly')  return `${label} · ${WEEKDAYS[d.getDay()]}`;
    if (u.frequency === 'yearly')  return `${label} · ${dayMonth}`;
    return `${label} · prélèvement ${dayMonth}`;
  }

  if (diffDays < 0)   return `en retard (${dayMonth})`;
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'demain';
  if (diffDays < 7)   return WEEKDAYS[d.getDay()];
  if (diffDays < 35)  return `dans ${Math.round(diffDays / 7)} semaine${diffDays >= 14 ? 's' : ''}`;
  if (d.getFullYear() !== today.getFullYear()) return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return dayMonth;
}

export default function Budget() {
  const {
    budget, expenses, summary, year, setYear, loading,
    categoryLimits,
    upcomingExpenses,
    saveBudgetTotal, saveCategoryLimit,
    addExpense, editExpense, removeExpense,
    addUpcoming, editUpcoming, removeUpcoming,
  } = useBudgetData();
  const addToast = useToastStore((s) => s.add);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState<ExpenseCategory | ''>('');
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [budgetTab, setBudgetTab] = useState<BudgetTab>('annual');
  const [showUpcomingForm, setShowUpcomingForm] = useState(false);
  const [editUpcomingId, setEditUpcomingId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const upcomingFormRef = useRef<HTMLFormElement>(null);

  const totalAllocated = budget?.total_allocated ?? 0;
  const totalSpent = summary.total;
  const remaining = totalAllocated - totalSpent;
  const percentUsed = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const filteredExpenses = useMemo(() => {
    if (!filterCat) return expenses;
    return expenses.filter((e) => e.category === filterCat);
  }, [expenses, filterCat]);

  const editItem = editId ? expenses.find((e) => e.id === editId) : null;

  // Breakdown per category: spent vs. user-editable limit (default 3000)
  const catRows = useMemo(() => CATEGORY_KEYS.map((k) => ({
    key: k,
    meta: CATEGORIES[k],
    spent: summary.byCategory[k] ?? 0,
    budget: categoryLimits[k],
    entries: expenses.filter((e) => e.category === k).length,
  })), [summary, categoryLimits, expenses]);

  async function handleSaveCatLimit(cat: ExpenseCategory, value: string) {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    await saveCategoryLimit(cat, amount);
    addToast('Limite mise à jour', 'success');
  }

  // Monthly rhythm for the selected year
  const monthlyTotals = useMemo(() => {
    const out = new Array(12).fill(0);
    expenses.forEach((e) => {
      const d = new Date(e.date);
      if (d.getFullYear() === year) out[d.getMonth()] += e.amount;
    });
    return out;
  }, [expenses, year]);
  const maxMonth = Math.max(1, ...monthlyTotals);
  const currentMonthIdx = new Date().getFullYear() === year ? new Date().getMonth() : -1;
  const activeMonths = monthlyTotals.filter((v) => v > 0).length;
  const avgMonth = activeMonths ? totalSpent / activeMonths : 0;

  const lastExpenses = useMemo(
    () => [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [expenses],
  );

  async function handleSaveTotal() {
    const amount = parseFloat(totalInput);
    if (isNaN(amount) || amount < 0) return;
    await saveBudgetTotal(amount);
    setEditingTotal(false);
    addToast('Budget mis à jour', 'success');
  }

  const upcomingEditItem = editUpcomingId
    ? upcomingExpenses.find((u) => u.id === editUpcomingId) ?? null
    : null;

  async function handleSubmitUpcoming(e: React.FormEvent) {
    e.preventDefault();
    const form = upcomingFormRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const recurring = fd.get('recurring') === 'on' ? 1 : 0;
    const rawFreq = (fd.get('frequency') as string) || '';
    const frequency: UpcomingFrequency =
      recurring && (rawFreq === 'weekly' || rawFreq === 'monthly' || rawFreq === 'yearly')
        ? rawFreq
        : '';
    const data: Omit<UpcomingExpense, 'id' | 'created_at'> = {
      title: (fd.get('title') as string).trim(),
      amount: parseFloat(fd.get('amount') as string) || 0,
      due_date: fd.get('due_date') as string,
      recurring,
      frequency,
      note: (fd.get('note') as string) ?? '',
    };
    if (!data.title || !data.due_date) return;

    try {
      if (editUpcomingId) {
        await editUpcoming(editUpcomingId, data);
        addToast('Prévision mise à jour', 'success');
      } else {
        await addUpcoming(data);
        addToast('Prévision ajoutée', 'success');
      }
    } catch {
      addToast('Erreur', 'error');
    }
    setShowUpcomingForm(false);
    setEditUpcomingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    let invoicePath: string | null = null;

    const data = {
      fiscal_year: year,
      title: fd.get('title') as string,
      category: fd.get('category') as ExpenseCategory,
      amount: parseFloat(fd.get('amount') as string) || 0,
      date: fd.get('date') as string,
      description: fd.get('description') as string,
      supplier: fd.get('supplier') as string,
      invoice_path: invoicePath as string | null,
      linked_intervenant_id: null,
      synced_from: '',
      last_sync_at: null,
      external_id: null,
    };

    try {
      if (editId) {
        if (invoiceFile) {
          try {
            invoicePath = await uploadInvoice(invoiceFile, year, String(editId));
            data.invoice_path = invoicePath;
          } catch { /* upload failed, keep null */ }
        }
        await editExpense(editId, data);
        addToast('Dépense mise à jour', 'success');
      } else {
        const id = await addExpense(data);
        if (invoiceFile && id) {
          try {
            invoicePath = await uploadInvoice(invoiceFile, year, String(id));
            await editExpense(id, { invoice_path: invoicePath });
          } catch { /* upload failed */ }
        }
        addToast('Dépense ajoutée', 'success');
      }
    } catch {
      addToast('Erreur', 'error');
    }

    setShowForm(false);
    setEditId(null);
    setInvoiceFile(null);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ height: 92 }} />
        <div className="card" style={{ height: 200 }} />
      </div>
    );
  }

  const tabs: Array<[BudgetTab, string]> = [
    ['annual', 'Annuel'],
    ['activity', 'Par activité'],
    ['balance', 'Solde rapide'],
  ];

  return (
    <div style={{ maxWidth: 1320, display: 'flex', flexDirection: 'column', gap: 20, animation: 'slide-in 0.22s ease-out' }}>
      {/* Top bar : pill tabs + right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 10 }}>
          {tabs.map(([k, l]) => {
            const active = budgetTab === k;
            return (
              <button
                key={k}
                onClick={() => setBudgetTab(k)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  border: 'none', cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div className="num" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          Exercice {year} · janv → déc
        </div>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          style={{
            padding: '6px 14px', border: '1px solid var(--line)', borderRadius: 999,
            fontSize: 13, background: 'var(--surface)', color: 'var(--ink)',
            cursor: 'pointer', appearance: 'none',
          }}
        >
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <SyncStatus module="budget" />
        <SyncButton module="budget" />
        <button
          className="btn primary"
          onClick={() => { setEditId(null); setShowForm(true); setInvoiceFile(null); }}
        >
          <Plus size={13} strokeWidth={2.5} /> Nouvelle dépense
        </button>
      </div>

      {budgetTab === 'annual' && (
        <AnnualView
          year={year}
          totalSpent={totalSpent}
          totalAllocated={totalAllocated}
          percentUsed={percentUsed}
          remaining={remaining}
          catRows={catRows}
          monthlyTotals={monthlyTotals}
          maxMonth={maxMonth}
          currentMonthIdx={currentMonthIdx}
          avgMonth={avgMonth}
          lastExpenses={lastExpenses}
          onSaveTotal={async (v) => {
            const amount = parseFloat(v);
            if (isNaN(amount) || amount < 0) return;
            await saveBudgetTotal(amount);
            addToast('Budget mis à jour', 'success');
          }}
          onSwitchToActivity={() => setBudgetTab('activity')}
          onSaveCatLimit={handleSaveCatLimit}
        />
      )}

      {budgetTab === 'activity' && (
        <ActivityView
          catRows={catRows}
          filteredExpenses={filteredExpenses}
          filterCat={filterCat}
          onChangeFilter={setFilterCat}
          onEdit={(id) => { setEditId(id); setShowForm(true); setInvoiceFile(null); }}
          onRemove={(id) => { removeExpense(id); addToast('Dépense supprimée', 'success'); }}
          onSaveCatLimit={handleSaveCatLimit}
        />
      )}

      {budgetTab === 'balance' && (
        <BalanceView
          totalAllocated={totalAllocated}
          totalSpent={totalSpent}
          remaining={remaining}
          percentUsed={percentUsed}
          upcoming={upcomingExpenses}
          onEditTotal={() => { setTotalInput(String(totalAllocated)); setEditingTotal(true); }}
          onNewExpense={() => { setEditId(null); setShowForm(true); setInvoiceFile(null); }}
          onAddUpcoming={() => { setEditUpcomingId(null); setShowUpcomingForm(true); }}
          onEditUpcoming={(id) => { setEditUpcomingId(id); setShowUpcomingForm(true); }}
          onRemoveUpcoming={(id) => { removeUpcoming(id); addToast('Prévision supprimée', 'success'); }}
        />
      )}

      {/* Modal form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => { setShowForm(false); setEditId(null); }}>
          <div style={{ backgroundColor: 'var(--surface)', borderRadius: 14, padding: 24, width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="serif" style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>
                {editId ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Titre
                <input name="title" defaultValue={editItem?.title ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Catégorie
                  <select name="category" defaultValue={editItem?.category ?? 'intervenants'} style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }}>
                    {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Montant (EUR)
                  <input name="amount" type="number" min="0" step="0.01" defaultValue={editItem?.amount ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
                </label>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Date
                  <input name="date" type="date" defaultValue={editItem?.date ?? new Date().toISOString().slice(0, 10)} required style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
                </label>
              </div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Fournisseur / Intervenant
                <input name="supplier" defaultValue={editItem?.supplier ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Description
                <textarea name="description" rows={2} defaultValue={editItem?.description ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, resize: 'vertical' }} />
              </label>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 6px' }}>Pièce jointe (facture)</p>
                {editItem?.invoice_path && !invoiceFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: 'var(--sage-deep)' }}>
                    <Paperclip size={12} /> Facture existante
                  </div>
                )}
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', border: '1.5px dashed var(--line)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  color: 'var(--ink-3)',
                  backgroundColor: invoiceFile ? 'var(--sage-soft)' : 'transparent',
                }}>
                  <FileIcon size={14} />
                  {invoiceFile ? invoiceFile.name : 'Joindre une facture (image/PDF)'}
                  <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <button type="submit" className="btn primary" style={{ justifyContent: 'center', padding: 10, marginTop: 4, fontSize: 14 }}>
                {editId ? 'Mettre à jour' : 'Ajouter la dépense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upcoming expense form */}
      {showUpcomingForm && (
        <UpcomingForm
          initial={upcomingEditItem}
          formRef={upcomingFormRef}
          onCancel={() => { setShowUpcomingForm(false); setEditUpcomingId(null); }}
          onSubmit={handleSubmitUpcoming}
        />
      )}

      {/* Edit-total modal (reachable from Balance) */}
      {editingTotal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
          onClick={() => setEditingTotal(false)}>
          <div className="card" style={{ padding: 20, width: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Budget total {year}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min="0" step="100" autoFocus
                value={totalInput} onChange={(e) => setTotalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTotal(); if (e.key === 'Escape') setEditingTotal(false); }}
                style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14 }}
              />
              <button className="btn primary" onClick={handleSaveTotal}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ Editable per-category limit ═══════════════════ */

interface EditableLimitProps {
  value: number;
  onSave: (v: string) => void | Promise<void>;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  showEuro?: boolean;
  title?: string;
}

function EditableLimit({ value, onSave, style, inputStyle, showEuro, title }: EditableLimitProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <input
        type="number" min="0" step="50" autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: 80, padding: '2px 6px',
          border: '1px solid var(--line-strong)', borderRadius: 4,
          fontSize: 13, fontFamily: 'var(--font-sans)',
          ...inputStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      type="button"
      title={title ?? 'Cliquer pour modifier la limite'}
      onClick={(e) => { e.stopPropagation(); setDraft(String(value)); setEditing(true); }}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: 'inherit', font: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span>{fmt(value)}{showEuro ? ' €' : ''}</span>
      <Pencil size={9} style={{ opacity: 0.5, flexShrink: 0 }} />
    </button>
  );
}

/* ═══════════════════ Annual view ═══════════════════ */

interface CatRow {
  key: ExpenseCategory;
  meta: { label: string; color: string; bg: string };
  spent: number;
  budget: number;
  entries: number;
}

interface AnnualProps {
  year: number;
  totalSpent: number;
  totalAllocated: number;
  percentUsed: number;
  remaining: number;
  catRows: CatRow[];
  monthlyTotals: number[];
  maxMonth: number;
  currentMonthIdx: number;
  avgMonth: number;
  lastExpenses: { id: number; date: string; title: string; supplier: string; amount: number; category: ExpenseCategory }[];
  onSaveTotal: (value: string) => void | Promise<void>;
  onSwitchToActivity: () => void;
  onSaveCatLimit: (cat: ExpenseCategory, value: string) => void | Promise<void>;
}

function AnnualView(p: AnnualProps) {
  const stackedTotal = Math.max(1, p.totalAllocated);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
      {/* LEFT */}
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow">Budget animation {p.year}</div>

        {/* Hero total — inline editable allocated amount */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <div className="serif num" style={{ fontSize: 42, fontWeight: 500, letterSpacing: -1.2, lineHeight: 1 }}>
            {fmt(p.totalSpent)}<span style={{ fontSize: 22, color: 'var(--ink-3)' }}> €</span>
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: 14, display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            sur
            <EditableLimit
              value={p.totalAllocated}
              onSave={p.onSaveTotal}
              showEuro
              title="Cliquer pour modifier le budget total"
              style={{ fontSize: 14, color: 'var(--ink-3)' }}
              inputStyle={{ width: 110, fontSize: 14 }}
            />
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
          {p.percentUsed.toFixed(0)}% engagé · {fmt(Math.max(p.remaining, 0))} € restants
        </div>

        {/* Stacked bar */}
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 18, background: 'var(--surface-2)' }}>
          {p.catRows.map((r) => (
            <div
              key={r.key}
              style={{ width: `${(r.spent / stackedTotal) * 100}%`, background: `var(--cat-${CAT_CLASS[r.key]})` }}
              title={`${r.meta.label} · ${fmt(r.spent)} €`}
            />
          ))}
        </div>

        {/* Per-category breakdown */}
        <div style={{ marginTop: 20 }}>
          {p.catRows.map((r, i) => {
            const pct = r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0;
            const over = pct > 90;
            const cls = CAT_CLASS[r.key];
            return (
              <div key={r.key} style={{
                display: 'grid', gridTemplateColumns: '14px 1fr 170px 80px',
                gap: 12, padding: '12px 0', alignItems: 'center',
                borderTop: i > 0 ? '1px solid var(--line)' : 'none',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: `var(--cat-${cls})` }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{r.meta.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(pct, 100)}%`, height: '100%',
                        background: over ? 'var(--warn)' : `var(--cat-${cls})`,
                      }} />
                    </div>
                    <div className="num" style={{ fontSize: 11, color: over ? 'var(--warn)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', minWidth: 32 }}>
                      {pct}%
                    </div>
                  </div>
                </div>
                <div className="num" style={{ fontSize: 13, textAlign: 'right', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                  {fmt(r.spent)} <span style={{ color: 'var(--ink-3)' }}>/ </span>
                  <EditableLimit
                    value={r.budget}
                    onSave={(v) => p.onSaveCatLimit(r.key, v)}
                    style={{ color: 'var(--ink-3)' }}
                    showEuro
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  {over && <span className="chip warn no-dot" style={{ fontSize: 10 }}>à surveiller</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow">Dernières dépenses</div>
          <div style={{ marginTop: 10 }}>
            {p.lastExpenses.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', padding: '12px 0' }}>
                Aucune dépense enregistrée.
              </div>
            )}
            {p.lastExpenses.map((e, i) => (
              <div key={e.id} style={{
                display: 'grid', gridTemplateColumns: '70px 1fr 80px',
                gap: 10, padding: '9px 0', alignItems: 'center',
                borderTop: i > 0 ? '1px solid var(--line)' : 'none',
              }}>
                <div className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                  {formatShortDate(e.date)}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.title}</div>
                  {e.supplier && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{e.supplier}</div>}
                </div>
                <div className="num" style={{ fontSize: 13, textAlign: 'right', fontWeight: 500 }}>-{fmt(e.amount)} €</div>
              </div>
            ))}
          </div>
          <button className="btn sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={p.onSwitchToActivity}>
            Voir toutes les dépenses
          </button>
        </div>

        <div className="card-soft" style={{ padding: 18 }}>
          <div className="eyebrow">Rythme mensuel</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, marginTop: 10 }}>
            {p.monthlyTotals.map((v, i) => {
              const active = i === p.currentMonthIdx;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max((v / p.maxMonth) * 50, v > 0 ? 4 : 2)}px`,
                    background: active ? 'var(--cat-creative)' : (v > 0 ? 'var(--line-strong)' : 'var(--line)'),
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <div className="num" style={{ fontSize: 9, color: 'var(--ink-3)' }}>{MONTH_LABELS[i]}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>
            Moy. {fmt(p.avgMonth)} €/mois
            {p.currentMonthIdx >= 0 && ` · ${MONTH_LABELS[p.currentMonthIdx]} = ${fmt(p.monthlyTotals[p.currentMonthIdx])} €`}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Activity view ═══════════════════ */

interface ActivityProps {
  catRows: CatRow[];
  filteredExpenses: { id: number; date: string; title: string; supplier: string; amount: number; category: ExpenseCategory; invoice_path: string | null }[];
  filterCat: ExpenseCategory | '';
  onChangeFilter: (v: ExpenseCategory | '') => void;
  onEdit: (id: number) => void;
  onRemove: (id: number) => void;
  onSaveCatLimit: (cat: ExpenseCategory, value: string) => void | Promise<void>;
}

function ActivityView(p: ActivityProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Per-category summary table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 130px 110px 160px 110px',
          gap: 12, padding: '12px 20px', background: 'var(--surface-2)',
          borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 600,
          color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          <div>Catégorie</div>
          <div style={{ textAlign: 'right' }}>Dépensé</div>
          <div style={{ textAlign: 'right' }}>Budget</div>
          <div>Consommation</div>
          <div style={{ textAlign: 'right' }}>Justificatifs</div>
        </div>
        {p.catRows.map((r, i) => {
          const pct = r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0;
          const cls = CAT_CLASS[r.key];
          return (
            <div key={r.key} style={{
              display: 'grid', gridTemplateColumns: '1fr 130px 110px 160px 110px',
              gap: 12, padding: '14px 20px', alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--line)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`chip ${cls}`} style={{ fontSize: 10.5 }}>{r.meta.label}</span>
              </div>
              <div className="num" style={{ textAlign: 'right', fontSize: 14, fontWeight: 500 }}>{fmt(r.spent)} €</div>
              <div className="num" style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink-3)' }}>
                <EditableLimit
                  value={r.budget}
                  onSave={(v) => p.onSaveCatLimit(r.key, v)}
                  showEuro
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(pct, 100)}%`, height: '100%',
                    background: pct > 90 ? 'var(--warn)' : `var(--cat-${cls})`,
                  }} />
                </div>
                <div className="num" style={{ fontSize: 11, color: pct > 90 ? 'var(--warn)' : 'var(--ink-3)', minWidth: 32 }}>{pct}%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button className="btn sm ghost" onClick={() => p.onChangeFilter(r.key)} style={{ padding: '3px 8px' }}>
                  <Folder size={12} /> {r.entries}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expenses list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="eyebrow" style={{ margin: 0, flex: 1 }}>Dépenses détaillées</h2>
          <div style={{ position: 'relative' }}>
            <select
              value={p.filterCat}
              onChange={(e) => p.onChangeFilter(e.target.value as ExpenseCategory | '')}
              style={{ padding: '5px 24px 5px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', appearance: 'none', cursor: 'pointer' }}
            >
              <option value="">Toutes</option>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-3)' }} />
          </div>
        </div>

        {p.filteredExpenses.length === 0 ? (
          <div style={{ padding: '28px 20px', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>
            Aucune dépense
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                {['Date', 'Titre', 'Catégorie', 'Fournisseur', 'Montant', 'PJ', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 16px',
                    textAlign: i === 4 ? 'right' : (i >= 5 ? 'center' : 'left'),
                    fontWeight: 600, color: 'var(--ink-3)', fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: 0.08,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.filteredExpenses.map((exp) => {
                const cls = CAT_CLASS[exp.category] ?? 'prep';
                const meta = CATEGORIES[exp.category] ?? CATEGORIES.other;
                return (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{formatDate(exp.date)}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink)' }}>{exp.title}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span className={`chip ${cls}`} style={{ fontSize: 10.5 }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--ink-3)' }}>{exp.supplier}</td>
                    <td className="num" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{fmt(exp.amount)} €</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {exp.invoice_path ? (
                        <a href={exp.invoice_path} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--terra-deep)' }} title="Voir la facture">
                          <Paperclip size={14} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--line-strong)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <button onClick={() => p.onEdit(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }} title="Modifier">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => p.onRemove(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }} title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ Balance view ═══════════════════ */

interface BalanceProps {
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  upcoming: UpcomingExpense[];
  onEditTotal: () => void;
  onNewExpense: () => void;
  onAddUpcoming: () => void;
  onEditUpcoming: (id: number) => void;
  onRemoveUpcoming: (id: number) => void;
}

function BalanceView(p: BalanceProps) {
  const positive = p.remaining >= 0;
  const gradBg = positive
    ? 'linear-gradient(135deg, var(--cat-body-bg), #f0ead8)'
    : 'linear-gradient(135deg, var(--danger-soft), #f7e0dc)';
  const accent = positive ? 'var(--cat-body)' : 'var(--danger)';

  const upcomingTotal = p.upcoming.reduce((a, u) => a + u.amount, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
      <div className="card" style={{ padding: 32, background: gradBg, border: `1px solid ${positive ? 'var(--cat-body-bg)' : 'var(--danger-soft)'}` }}>
        <div className="eyebrow" style={{ color: accent }}>Solde restant</div>
        <div className="serif num" style={{ fontSize: 64, fontWeight: 500, letterSpacing: -2, lineHeight: 1, marginTop: 8, color: accent }}>
          {fmt(p.remaining)}<span style={{ fontSize: 32 }}> €</span>
        </div>
        <div style={{ fontSize: 14, color: accent, opacity: 0.85, marginTop: 6 }}>
          {fmt(p.totalSpent)} € dépensés sur {fmt(p.totalAllocated)} € · {p.percentUsed.toFixed(0)} % consommés
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn primary" onClick={p.onNewExpense}>
            <Plus size={12} /> Nouvelle dépense
          </button>
          <button className="btn" onClick={p.onNewExpense}>
            <Camera size={12} /> Photo d'un ticket
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="eyebrow" style={{ flex: 1 }}>À l'arrivée (à prévoir)</div>
          <button className="btn sm" onClick={p.onAddUpcoming} title="Ajouter une prévision">
            <Plus size={11} /> Ajouter
          </button>
        </div>

        {p.upcoming.length === 0 ? (
          <div style={{ padding: '24px 0', fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', textAlign: 'center' }}>
            Aucun prélèvement programmé pour le moment.
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            {p.upcoming.map((u, i) => (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: 10, padding: '12px 0', alignItems: 'center',
                borderTop: i > 0 ? '1px solid var(--line)' : 'none',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 14 }}>
                    {u.recurring ? <Repeat size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} /> : null}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{dueLabel(u)}</div>
                </div>
                <div className="num" style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                  -{fmt(u.amount)} €
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button onClick={() => p.onEditUpcoming(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }} title="Modifier">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => p.onRemoveUpcoming(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }} title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            <div style={{
              marginTop: 14, padding: 12, borderRadius: 8,
              background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink-3)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Total prévu</span>
              <span className="num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmt(upcomingTotal)} €</span>
            </div>
          </div>
        )}

        <button className="btn sm" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={p.onEditTotal}>
          <Pencil size={12} /> Modifier le budget total
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════ Upcoming-expense form modal ═══════════════════ */

interface UpcomingFormProps {
  initial: UpcomingExpense | null;
  formRef: React.RefObject<HTMLFormElement | null>;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function UpcomingForm({ initial, formRef, onCancel, onSubmit }: UpcomingFormProps) {
  const [recurring, setRecurring] = useState(!!initial?.recurring);
  const defaultFreq: UpcomingFrequency = (initial?.frequency as UpcomingFrequency) || 'monthly';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onCancel}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>
            {initial ? 'Modifier la prévision' : 'Nouvelle prévision'}
          </h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Titre
            <input name="title" defaultValue={initial?.title ?? ''} required
              style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Montant (€)
              <input name="amount" type="number" min="0" step="0.01" defaultValue={initial?.amount ?? ''} required
                style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              {recurring ? 'Prochaine échéance' : 'Date'}
              <input name="due_date" type="date" defaultValue={initial?.due_date ?? today} required
                style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }} />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="recurring"
              defaultChecked={!!initial?.recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            <Repeat size={13} style={{ color: 'var(--ink-3)' }} />
            Dépense récurrente
          </label>

          {recurring && (
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Fréquence
              <select name="frequency" defaultValue={defaultFreq}
                style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }}>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
                <option value="yearly">Annuel</option>
              </select>
            </label>
          )}

          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Note (optionnel)
            <textarea name="note" rows={2} defaultValue={initial?.note ?? ''}
              style={{ width: '100%', padding: '8px 10px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, resize: 'vertical' }} />
          </label>

          <button type="submit" className="btn primary" style={{ justifyContent: 'center', padding: 10, marginTop: 4, fontSize: 14 }}>
            {initial ? 'Mettre à jour' : 'Ajouter la prévision'}
          </button>
        </form>
      </div>
    </div>
  );
}
