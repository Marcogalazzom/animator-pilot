import { useState, useRef, useMemo } from 'react';
import {
  Plus, X, Trash2, Pencil, ChevronDown,
  Receipt, Paperclip, FileText as FileIcon,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useBudgetData, CATEGORIES, CATEGORY_KEYS } from './budget/useBudgetData';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import { uploadInvoice } from '@/services/firebase';
import type { ExpenseCategory } from '@/db/types';

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function progressColor(pct: number): string {
  if (pct < 75) return 'var(--color-success)';
  if (pct < 90) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

// ─── Component ───────────────────────────────────────────────

export default function Budget() {
  const {
    budget, expenses, summary, year, setYear,
    loading, saveBudgetTotal, addExpense, editExpense, removeExpense,
  } = useBudgetData();
  const addToast = useToastStore((s) => s.add);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState<ExpenseCategory | ''>('');
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const totalAllocated = budget?.total_allocated ?? 0;
  const totalSpent = summary.total;
  const remaining = totalAllocated - totalSpent;
  const percentUsed = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const filteredExpenses = useMemo(() => {
    if (!filterCat) return expenses;
    return expenses.filter((e) => e.category === filterCat);
  }, [expenses, filterCat]);

  const editItem = editId ? expenses.find((e) => e.id === editId) : null;

  async function handleSaveTotal() {
    const amount = parseFloat(totalInput);
    if (isNaN(amount) || amount < 0) return;
    await saveBudgetTotal(amount);
    setEditingTotal(false);
    addToast('Budget mis à jour', 'success');
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
        // Upload invoice if new file
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
        // Upload invoice after creation (need the id)
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
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '200px', height: '28px', borderRadius: '6px', background: 'var(--color-border)' }} className="shimmer" />
        <div style={{ width: '100%', height: '120px', borderRadius: '8px', background: 'var(--color-surface)' }} className="shimmer" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Budget Animation
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)' }}>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <SyncStatus module="budget" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SyncButton module="budget" />
          <button onClick={() => { setEditId(null); setShowForm(true); setInvoiceFile(null); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
            <Plus size={14} /> Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>
            Budget utilisé
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', color: progressColor(percentUsed) }}>
            {percentUsed.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: '10px', backgroundColor: 'var(--color-border)', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(percentUsed, 100)}%`,
            backgroundColor: progressColor(percentUsed), borderRadius: '5px',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
          {fmt(totalSpent)} EUR dépensés sur {fmt(totalAllocated)} EUR
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {/* Budget total */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid var(--color-primary)' }}>
          {editingTotal ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={totalInput} onChange={(e) => setTotalInput(e.target.value)} type="number" min="0" step="100" autoFocus
                style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '14px' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTotal(); if (e.key === 'Escape') setEditingTotal(false); }} />
              <button onClick={handleSaveTotal} style={{ padding: '6px 10px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>OK</button>
            </div>
          ) : (
            <div onClick={() => { setTotalInput(String(totalAllocated)); setEditingTotal(true); }} style={{ cursor: 'pointer' }} title="Cliquez pour modifier">
              <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
                {fmt(totalAllocated)} <span style={{ fontSize: '13px', fontWeight: 400 }}>EUR</span>
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Budget total <Pencil size={10} style={{ marginLeft: '4px', verticalAlign: 'middle' }} /></p>
            </div>
          )}
        </div>

        {/* Dépensé */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${progressColor(percentUsed)}` }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: progressColor(percentUsed), fontFamily: 'var(--font-sans)' }}>
            {fmt(totalSpent)} <span style={{ fontSize: '13px', fontWeight: 400 }}>EUR</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Dépensé</p>
        </div>

        {/* Restant */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-sans)' }}>
            {fmt(remaining)} <span style={{ fontSize: '13px', fontWeight: 400 }}>EUR</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Restant</p>
        </div>

        {/* Nb factures */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid #64748B' }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>{summary.count}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Dépenses</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Répartition par catégorie
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CATEGORY_KEYS.map((cat) => {
            const meta = CATEGORIES[cat];
            const amount = summary.byCategory[cat];
            const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: meta.color, fontFamily: 'var(--font-sans)' }}>{meta.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {fmt(amount)} EUR ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: meta.color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense list */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Receipt size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
            Dépenses
          </h2>
          <div style={{ position: 'relative' }}>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as ExpenseCategory | '')}
              style={{ padding: '5px 24px 5px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer' }}>
              <option value="">Toutes</option>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div style={{ padding: '24px 20px', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
            Aucune dépense
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Titre</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catégorie</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fournisseur</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Montant</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PJ</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const cat = CATEGORIES[exp.category] ?? CATEGORIES.other;
                return (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(exp.date)}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{exp.title}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: cat.color, backgroundColor: cat.bg, padding: '2px 8px', borderRadius: '4px' }}>
                        {cat.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{exp.supplier}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmt(exp.amount)} EUR</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {exp.invoice_path ? (
                        <a href={exp.invoice_path} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }} title="Voir la facture">
                          <Paperclip size={14} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-border)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        <button onClick={() => { setEditId(exp.id); setShowForm(true); setInvoiceFile(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => { removeExpense(exp.id); addToast('Dépense supprimée', 'success'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
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

      {/* Modal form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => { setShowForm(false); setEditId(null); }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                {editId ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={18} /></button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Titre
                <input name="title" defaultValue={editItem?.title ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Catégorie
                  <select name="category" defaultValue={editItem?.category ?? 'intervenants'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Montant (EUR)
                  <input name="amount" type="number" min="0" step="0.01" defaultValue={editItem?.amount ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Date
                  <input name="date" type="date" defaultValue={editItem?.date ?? new Date().toISOString().slice(0, 10)} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Fournisseur / Intervenant
                <input name="supplier" defaultValue={editItem?.supplier ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Description
                <textarea name="description" rows={2} defaultValue={editItem?.description ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
              {/* Invoice attachment */}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', margin: '0 0 6px' }}>
                  Pièce jointe (facture)
                </p>
                {editItem?.invoice_path && !invoiceFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', color: 'var(--color-success)' }}>
                    <Paperclip size={12} /> Facture existante
                  </div>
                )}
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', border: '1.5px dashed var(--color-border)',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                  fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)',
                  backgroundColor: invoiceFile ? 'rgba(5,150,105,0.04)' : 'transparent',
                }}>
                  <FileIcon size={14} />
                  {invoiceFile ? invoiceFile.name : 'Joindre une facture (image/PDF)'}
                  <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <button type="submit" style={{
                padding: '10px', backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: '4px',
              }}>
                {editId ? 'Mettre à jour' : 'Ajouter la dépense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
