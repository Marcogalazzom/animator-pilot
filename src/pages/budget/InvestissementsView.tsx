import { useState } from 'react';
import { Plus, Hammer, Banknote, CreditCard, CheckCircle2, Trash2 } from 'lucide-react';
import type { Investment, InvestmentStatus } from '@/db/types';

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M€';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + ' k€';
  return fmt(n) + ' €';
}

const STATUS_LABELS: Record<InvestmentStatus, string> = { planned: 'Planifié', in_progress: 'En cours', completed: 'Terminé' };
const STATUS_COLORS: Record<InvestmentStatus, string> = { planned: 'var(--color-text-secondary)', in_progress: 'var(--color-primary)', completed: 'var(--color-success)' };

interface Props {
  investments: Investment[];
  fiscalYear: number;
  onAdd: (inv: Omit<Investment, 'id' | 'created_at'>) => Promise<number>;
  onDelete: (id: number) => Promise<void>;
}

export default function InvestissementsView({ investments, fiscalYear, onAdd, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [planned, setPlanned] = useState('');
  const [source, setSource] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const totalPlanned = investments.reduce((s, i) => s + i.amount_planned, 0);
  const totalCommitted = investments.reduce((s, i) => s + i.amount_committed, 0);
  const totalRealized = investments.reduce((s, i) => s + i.amount_realized, 0);

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px',
    fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
  };

  async function handleAdd() {
    if (!title.trim()) return;
    await onAdd({
      title: title.trim(), description: desc,
      amount_planned: parseFloat(planned.replace(/\s/g, '').replace(',', '.')) || 0,
      amount_committed: 0, amount_realized: 0,
      funding_source: source, start_date: null, end_date: null,
      status: 'planned', fiscal_year: fiscalYear,
    });
    setShowForm(false);
    setTitle(''); setDesc(''); setPlanned(''); setSource('');
  }

  return (
    <>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Planifié', value: totalPlanned, icon: <Banknote size={14} />, color: 'var(--color-text-secondary)' },
          { label: 'Engagé', value: totalCommitted, icon: <CreditCard size={14} />, color: 'var(--color-primary)' },
          { label: 'Réalisé', value: totalRealized, icon: <CheckCircle2 size={14} />, color: 'var(--color-success)' },
        ].map((c) => (
          <div key={c.label} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '4px' }}>{c.icon} {c.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-sans)', color: c.color }}>{fmtShort(c.value)}</div>
          </div>
        ))}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setShowForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}>
            <Plus size={14} /> Nouvel investissement
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: 0 }}>Nouvel investissement</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: '4px' }}>Titre</label><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Rénovation aile B" /></div>
            <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: '4px' }}>Source de financement</label><input value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} placeholder="Autofinancement, Emprunt..." /></div>
            <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: '4px' }}>Montant prévu (€)</label><input value={planned} onChange={(e) => setPlanned(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0" /></div>
            <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: '4px' }}>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} placeholder="Optionnel" /></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', fontSize: '13px', fontFamily: 'var(--font-sans)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Annuler</button>
            <button onClick={handleAdd} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Créer</button>
          </div>
        </div>
      )}

      {/* Investment list */}
      {investments.length === 0 && !showForm ? (
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <Hammer size={36} style={{ color: 'var(--color-border)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Aucun investissement pour cet exercice.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {investments.map((inv) => {
            const pct = inv.amount_planned > 0 ? (inv.amount_realized / inv.amount_planned) * 100 : 0;
            return (
              <div key={inv.id} style={{
                backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${STATUS_COLORS[inv.status]}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{inv.title}</div>
                    {inv.description && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{inv.description}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                      color: STATUS_COLORS[inv.status],
                      backgroundColor: inv.status === 'completed' ? 'rgba(5,150,105,0.08)' : inv.status === 'in_progress' ? 'rgba(30,64,175,0.08)' : 'rgba(0,0,0,0.04)',
                    }}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                    <button onClick={() => confirmDelete === inv.id ? onDelete(inv.id).then(() => setConfirmDelete(null)) : setConfirmDelete(inv.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: confirmDelete === inv.id ? 'var(--color-danger)' : 'var(--color-text-secondary)', opacity: confirmDelete === inv.id ? 1 : 0.4 }}
                      title={confirmDelete === inv.id ? 'Confirmer' : 'Supprimer'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px', fontFamily: 'var(--font-sans)', marginBottom: '8px' }}>
                  <div><span style={{ color: 'var(--color-text-secondary)' }}>Planifié</span><div style={{ fontWeight: 600 }}>{fmt(inv.amount_planned)} €</div></div>
                  <div><span style={{ color: 'var(--color-text-secondary)' }}>Engagé</span><div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{fmt(inv.amount_committed)} €</div></div>
                  <div><span style={{ color: 'var(--color-text-secondary)' }}>Réalisé</span><div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmt(inv.amount_realized)} €</div></div>
                </div>
                {inv.funding_source && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Source : {inv.funding_source}</div>}
                <div style={{ height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 100 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-primary)' : 'var(--color-warning)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', textAlign: 'right' }}>{pct.toFixed(0)}% réalisé</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
