import { useState, useMemo, useCallback } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle,
  Plus, FileSpreadsheet, X, Loader2,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

import { useBudgetData, CHARGE_TITLES, PRODUIT_TITLES } from './budget/useBudgetData';
import ERRDView from './budget/ERRDView';
import InvestissementsView from './budget/InvestissementsView';
import type { BudgetLine, BudgetLineType } from '@/db/types';

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M€';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + ' k€';
  return fmt(n) + ' €';
}

// ─── Sub-components ──────────────────────────────────────────

type Tab = 'synthese' | 'eprd' | 'errd' | 'investissements';

const TAB_LABELS: Record<Tab, string> = {
  synthese: 'Synthèse',
  eprd: 'EPRD',
  errd: 'ERRD',
  investissements: 'Investissements',
};

// ─── Tooltip ─────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function BudgetChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '6px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'var(--font-sans)',
    }}>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: p.color }}>
          {p.name}: {fmtShort(p.value)}
        </p>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════

export default function Budget() {
  const data = useBudgetData();
  const addToast = useToastStore((s) => s.add);
  const [tab, setTab] = useState<Tab>('synthese');
  const [addingLine, setAddingLine] = useState<{ titleNum: number; lineType: BudgetLineType } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const years = [2024, 2025, 2026, 2027];

  // ── Computed EPRD data ──
  const charges = useMemo(() => data.lines.filter((l) => l.line_type === 'charge'), [data.lines]);
  const produits = useMemo(() => data.lines.filter((l) => l.line_type === 'produit'), [data.lines]);

  const chargesByTitle = useMemo(() => {
    const groups: Record<number, BudgetLine[]> = {};
    for (const l of charges) {
      (groups[l.title_number] ??= []).push(l);
    }
    return groups;
  }, [charges]);

  const produitsByTitle = useMemo(() => {
    const groups: Record<number, BudgetLine[]> = {};
    for (const l of produits) {
      (groups[l.title_number] ??= []).push(l);
    }
    return groups;
  }, [produits]);

  const totalCharges = charges.reduce((s, l) => s + l.amount_previsionnel, 0);
  const totalProduits = produits.reduce((s, l) => s + l.amount_previsionnel, 0);
  const result = totalProduits - totalCharges;

  // ── Chart data ──
  const chartData = data.summary.map((s) => ({
    name: s.label,
    Charges: s.totalCharges,
    Produits: s.totalProduits,
  }));

  const hasDeficit = data.summary.some((s) => s.result < 0);

  // ── Handlers ──
  const handleStartEdit = useCallback((line: BudgetLine) => {
    setEditingId(line.id);
    setEditValue(line.amount_previsionnel.toString());
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingId === null) return;
    const val = parseFloat(editValue.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(val)) { setEditingId(null); return; }
    setSaving(true);
    await data.editLine(editingId, { amount_previsionnel: val });
    setEditingId(null);
    setSaving(false);
  }, [editingId, editValue, data]);

  const handleAddLine = useCallback(async () => {
    if (!addingLine || !newLabel.trim() || !data.selectedSectionId) return;
    const amt = parseFloat(newAmount.replace(/\s/g, '').replace(',', '.')) || 0;
    await data.addLine({
      section_id: data.selectedSectionId,
      title_number: addingLine.titleNum,
      line_label: newLabel.trim(),
      line_type: addingLine.lineType,
      amount_previsionnel: amt,
      amount_realise: 0,
      fiscal_year: data.selectedYear,
      period: null,
    });
    setAddingLine(null);
    setNewLabel('');
    setNewAmount('');
  }, [addingLine, newLabel, newAmount, data]);

  const handleDeleteLine = useCallback(async (id: number) => {
    await data.removeLine(id);
  }, [data]);

  const handleInitTemplate = useCallback(async () => {
    if (!data.selectedSectionId) return;
    setSaving(true);
    try {
      await data.initFromTemplate(data.selectedSectionId, data.selectedYear);
      addToast('Modèle budgétaire initialisé', 'success');
    } catch {
      addToast('Erreur lors de l\'initialisation', 'error');
    } finally {
      setSaving(false);
    }
  }, [data, addToast]);

  // ── Input style ──
  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px',
    fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none',
    width: '100%',
  };

  // ── Loading state ──
  if (data.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '40px', color: 'var(--color-text-secondary)' }}>
        <Loader2 size={18} className="animate-spin" /> Chargement...
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
            Gestion budgétaire
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Suivi des 3 sections tarifaires
          </p>
        </div>

        {/* Year selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Exercice :</span>
          <select
            value={data.selectedYear}
            onChange={(e) => data.setSelectedYear(Number(e.target.value))}
            style={{
              ...inputStyle, width: 'auto', padding: '6px 28px 6px 10px',
              appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748B\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--color-border)' }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const isActive = tab === t;
          const isDisabled = t === 'errd' || t === 'investissements';
          return (
            <button
              key={t}
              onClick={() => !isDisabled && setTab(t)}
              disabled={isDisabled}
              style={{
                padding: '10px 20px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                border: 'none', background: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
                color: isDisabled ? 'var(--color-border)' : isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: '-2px', transition: 'all 0.15s ease',
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      {tab === 'synthese' && (
        <SyntheseView summary={data.summary} caf={data.caf} chartData={chartData} hasDeficit={hasDeficit} />
      )}

      {tab === 'eprd' && (
        <EPRDView
          sections={data.sections}
          selectedSectionId={data.selectedSectionId}
          onSelectSection={data.setSelectedSectionId}
          chargesByTitle={chargesByTitle}
          produitsByTitle={produitsByTitle}
          totalCharges={totalCharges}
          totalProduits={totalProduits}
          result={result}
          lines={data.lines}
          editingId={editingId}
          editValue={editValue}
          setEditValue={setEditValue}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onDeleteLine={handleDeleteLine}
          addingLine={addingLine}
          setAddingLine={setAddingLine}
          newLabel={newLabel}
          setNewLabel={setNewLabel}
          newAmount={newAmount}
          setNewAmount={setNewAmount}
          onAddLine={handleAddLine}
          onInitTemplate={handleInitTemplate}
          saving={saving}
          inputStyle={inputStyle}
        />
      )}

      {tab === 'errd' && (
        <ERRDView
          sections={data.sections}
          selectedSectionId={data.selectedSectionId}
          onSelectSection={data.setSelectedSectionId}
          lines={data.lines}
          onEditRealise={async (id, amount) => { await data.editLine(id, { amount_realise: amount }); }}
        />
      )}

      {tab === 'investissements' && (
        <InvestissementsView
          investments={data.investments}
          fiscalYear={data.selectedYear}
          onAdd={data.addInvestment}
          onDelete={data.removeInvestment}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Synthèse View
// ═════════════════════════════════════════════════════════════

interface SyntheseProps {
  summary: { section: string; label: string; totalCharges: number; totalProduits: number; result: number }[];
  caf: number;
  chartData: { name: string; Charges: number; Produits: number }[];
  hasDeficit: boolean;
}

function SyntheseView({ summary, caf, chartData, hasDeficit }: SyntheseProps) {
  return (
    <>
      {/* Deficit warning */}
      {hasDeficit && (
        <div role="alert" style={{
          backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid var(--color-danger)',
          borderLeft: '4px solid var(--color-danger)', borderRadius: '8px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-danger)', fontFamily: 'var(--font-sans)' }}>
            Attention — une ou plusieurs sections présentent un déficit prévisionnel.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {summary.map((s) => (
          <div key={s.section} style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px',
            borderLeft: `3px solid ${s.result >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}`,
          }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 500, marginBottom: '8px' }}>
              {s.label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '4px' }}>
              <span>Charges</span><span>{fmtShort(s.totalCharges)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '8px' }}>
              <span>Produits</span><span>{fmtShort(s.totalProduits)}</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px solid var(--color-border)', paddingTop: '8px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Résultat</span>
              <span style={{
                fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                color: s.result >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {s.result >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {fmtShort(s.result)}
              </span>
            </div>
          </div>
        ))}

        {/* CAF card */}
        <div style={{
          backgroundColor: 'var(--color-surface)', borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px',
          borderLeft: `3px solid ${caf >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'}`,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 500, marginBottom: '8px' }}>
            <Wallet size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
            CAF prévisionnelle
          </div>
          <div style={{
            fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-sans)',
            color: caf >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
          }}>
            {fmtShort(caf)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginTop: '4px' }}>
            Capacité d'autofinancement
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{
          backgroundColor: 'var(--color-surface)', borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
        }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
            Charges vs Produits par section
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip content={<BudgetChartTooltip />} />
              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-sans)', paddingBottom: '8px' }} />
              <Bar dataKey="Charges" fill="var(--color-danger)" radius={[3, 3, 0, 0]} opacity={0.8} />
              <Bar dataKey="Produits" fill="var(--color-success)" radius={[3, 3, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// EPRD View
// ═════════════════════════════════════════════════════════════

interface EPRDProps {
  sections: { id: number; name: string; label: string }[];
  selectedSectionId: number | null;
  onSelectSection: (id: number) => void;
  chargesByTitle: Record<number, BudgetLine[]>;
  produitsByTitle: Record<number, BudgetLine[]>;
  totalCharges: number;
  totalProduits: number;
  result: number;
  lines: BudgetLine[];
  editingId: number | null;
  editValue: string;
  setEditValue: (v: string) => void;
  onStartEdit: (line: BudgetLine) => void;
  onSaveEdit: () => void;
  onDeleteLine: (id: number) => void;
  addingLine: { titleNum: number; lineType: BudgetLineType } | null;
  setAddingLine: (v: { titleNum: number; lineType: BudgetLineType } | null) => void;
  newLabel: string;
  setNewLabel: (v: string) => void;
  newAmount: string;
  setNewAmount: (v: string) => void;
  onAddLine: () => void;
  onInitTemplate: () => void;
  saving: boolean;
  inputStyle: React.CSSProperties;
}

function EPRDView(props: EPRDProps) {
  const {
    sections, selectedSectionId, onSelectSection,
    chargesByTitle, produitsByTitle, totalCharges, totalProduits, result,
    lines, editingId, editValue, setEditValue, onStartEdit, onSaveEdit,
    onDeleteLine, addingLine, setAddingLine, newLabel, setNewLabel,
    newAmount, setNewAmount, onAddLine, onInitTemplate, saving, inputStyle,
  } = props;

  const cellStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: '13px', fontFamily: 'var(--font-sans)',
    borderBottom: '1px solid var(--color-border)',
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle, fontWeight: 700, backgroundColor: 'rgba(30,64,175,0.04)',
    color: 'var(--color-text-primary)',
  };
  const totalRowStyle: React.CSSProperties = {
    ...cellStyle, fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.02)',
    color: 'var(--color-text-primary)', fontSize: '14px',
  };

  // Show template init if no lines
  if (lines.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '48px 24px',
        textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <FileSpreadsheet size={40} style={{ color: 'var(--color-primary)', marginBottom: '12px', opacity: 0.6 }} />
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-sans)' }}>
          Aucune ligne budgétaire
        </p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
          Initialisez l'EPRD avec le modèle standard EHPAD ou ajoutez vos lignes manuellement.
        </p>
        <button
          onClick={onInitTemplate}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 20px', backgroundColor: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <FileSpreadsheet size={14} />
          {saving ? 'Initialisation...' : 'Initialiser depuis le modèle'}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Section sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '0' }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSection(s.id)}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              border: `1px solid ${selectedSectionId === s.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              backgroundColor: selectedSectionId === s.id ? 'var(--color-primary)' : 'var(--color-surface)',
              color: selectedSectionId === s.id ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* EPRD Table */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', width: '60%' }}>Libellé</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right', width: '30%' }}>Montant prévisionnel (€)</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'center', width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {/* ── CHARGES ── */}
            <tr><td colSpan={3} style={{ ...headerCellStyle, fontSize: '14px', letterSpacing: '0.05em', color: 'var(--color-danger)' }}>CHARGES</td></tr>

            {[1, 2, 3, 4].map((titleNum) => {
              const titleLines = chargesByTitle[titleNum] ?? [];
              const titleTotal = titleLines.reduce((s, l) => s + l.amount_previsionnel, 0);
              return (
                <TitleSection
                  key={`c-${titleNum}`}
                  titleNum={titleNum}
                  titleLabel={CHARGE_TITLES[titleNum]}
                  lines={titleLines}
                  total={titleTotal}
                  lineType="charge"
                  cellStyle={cellStyle}
                  headerCellStyle={headerCellStyle}
                  editingId={editingId}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onDeleteLine={onDeleteLine}
                  addingLine={addingLine}
                  setAddingLine={setAddingLine}
                  newLabel={newLabel}
                  setNewLabel={setNewLabel}
                  newAmount={newAmount}
                  setNewAmount={setNewAmount}
                  onAddLine={onAddLine}
                  inputStyle={inputStyle}
                />
              );
            })}

            {/* Total charges */}
            <tr><td style={totalRowStyle}>TOTAL CHARGES</td><td style={{ ...totalRowStyle, textAlign: 'right', color: 'var(--color-danger)' }}>{fmt(totalCharges)}</td><td style={totalRowStyle}></td></tr>

            {/* Spacer */}
            <tr><td colSpan={3} style={{ height: '12px', border: 'none' }}></td></tr>

            {/* ── PRODUITS ── */}
            <tr><td colSpan={3} style={{ ...headerCellStyle, fontSize: '14px', letterSpacing: '0.05em', color: 'var(--color-success)' }}>PRODUITS</td></tr>

            {[1, 2, 3].map((titleNum) => {
              const titleLines = produitsByTitle[titleNum] ?? [];
              const titleTotal = titleLines.reduce((s, l) => s + l.amount_previsionnel, 0);
              return (
                <TitleSection
                  key={`p-${titleNum}`}
                  titleNum={titleNum}
                  titleLabel={PRODUIT_TITLES[titleNum]}
                  lines={titleLines}
                  total={titleTotal}
                  lineType="produit"
                  cellStyle={cellStyle}
                  headerCellStyle={headerCellStyle}
                  editingId={editingId}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onDeleteLine={onDeleteLine}
                  addingLine={addingLine}
                  setAddingLine={setAddingLine}
                  newLabel={newLabel}
                  setNewLabel={setNewLabel}
                  newAmount={newAmount}
                  setNewAmount={setNewAmount}
                  onAddLine={onAddLine}
                  inputStyle={inputStyle}
                />
              );
            })}

            {/* Total produits */}
            <tr><td style={totalRowStyle}>TOTAL PRODUITS</td><td style={{ ...totalRowStyle, textAlign: 'right', color: 'var(--color-success)' }}>{fmt(totalProduits)}</td><td style={totalRowStyle}></td></tr>

            {/* Spacer */}
            <tr><td colSpan={3} style={{ height: '12px', border: 'none' }}></td></tr>

            {/* ── RÉSULTAT ── */}
            <tr>
              <td style={{ ...totalRowStyle, fontSize: '15px', backgroundColor: result >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)' }}>
                RÉSULTAT PRÉVISIONNEL
              </td>
              <td style={{
                ...totalRowStyle, textAlign: 'right', fontSize: '15px',
                color: result >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                backgroundColor: result >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
              }}>
                {fmt(result)}
              </td>
              <td style={{ ...totalRowStyle, backgroundColor: result >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)' }}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// Title Section (sub-component for EPRD table)
// ═════════════════════════════════════════════════════════════

interface TitleSectionProps {
  titleNum: number;
  titleLabel: string;
  lines: BudgetLine[];
  total: number;
  lineType: BudgetLineType;
  cellStyle: React.CSSProperties;
  headerCellStyle: React.CSSProperties;
  editingId: number | null;
  editValue: string;
  setEditValue: (v: string) => void;
  onStartEdit: (line: BudgetLine) => void;
  onSaveEdit: () => void;
  onDeleteLine: (id: number) => void;
  addingLine: { titleNum: number; lineType: BudgetLineType } | null;
  setAddingLine: (v: { titleNum: number; lineType: BudgetLineType } | null) => void;
  newLabel: string;
  setNewLabel: (v: string) => void;
  newAmount: string;
  setNewAmount: (v: string) => void;
  onAddLine: () => void;
  inputStyle: React.CSSProperties;
}

function TitleSection(props: TitleSectionProps) {
  const {
    titleNum, titleLabel, lines, total, lineType,
    cellStyle, headerCellStyle,
    editingId, editValue, setEditValue, onStartEdit, onSaveEdit,
    onDeleteLine, addingLine, setAddingLine,
    newLabel, setNewLabel, newAmount, setNewAmount, onAddLine, inputStyle,
  } = props;

  const isAdding = addingLine?.titleNum === titleNum && addingLine?.lineType === lineType;

  return (
    <>
      {/* Title header */}
      <tr>
        <td style={{ ...headerCellStyle, paddingLeft: '24px', fontSize: '12px', fontWeight: 600 }}>{titleLabel}</td>
        <td style={{ ...headerCellStyle, textAlign: 'right', fontSize: '12px' }}>{fmt(total)}</td>
        <td style={headerCellStyle}></td>
      </tr>

      {/* Lines */}
      {lines.map((line) => (
        <tr key={line.id}>
          <td style={{ ...cellStyle, paddingLeft: '44px', color: 'var(--color-text-primary)' }}>
            {line.line_label}
          </td>
          <td style={{ ...cellStyle, textAlign: 'right' }}>
            {editingId === line.id ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={onSaveEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') { setEditValue(''); onSaveEdit(); } }}
                autoFocus
                style={{ ...inputStyle, textAlign: 'right', width: '140px' }}
              />
            ) : (
              <span
                onClick={() => onStartEdit(line)}
                style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.15s' }}
                title="Cliquer pour modifier"
              >
                {fmt(line.amount_previsionnel)}
              </span>
            )}
          </td>
          <td style={{ ...cellStyle, textAlign: 'center' }}>
            <button
              onClick={() => onDeleteLine(line.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: 'var(--color-text-secondary)', opacity: 0.4, transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              title="Supprimer"
            >
              <X size={14} />
            </button>
          </td>
        </tr>
      ))}

      {/* Add line form */}
      {isAdding ? (
        <tr>
          <td style={{ ...cellStyle, paddingLeft: '44px' }}>
            <input type="text" placeholder="Libellé" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={inputStyle} autoFocus />
          </td>
          <td style={{ ...cellStyle, textAlign: 'right' }}>
            <input type="text" placeholder="0,00" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onAddLine(); }}
              style={{ ...inputStyle, textAlign: 'right', width: '140px' }} />
          </td>
          <td style={{ ...cellStyle, textAlign: 'center', display: 'flex', gap: '4px', justifyContent: 'center' }}>
            <button onClick={onAddLine} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-success)', padding: '4px' }} title="Confirmer">
              <Plus size={14} />
            </button>
            <button onClick={() => setAddingLine(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Annuler">
              <X size={14} />
            </button>
          </td>
        </tr>
      ) : (
        <tr>
          <td colSpan={3} style={{ ...cellStyle, paddingLeft: '44px' }}>
            <button
              onClick={() => { setAddingLine({ titleNum, lineType }); setNewLabel(''); setNewAmount(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px',
                color: 'var(--color-primary)', fontFamily: 'var(--font-sans)', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0',
              }}
            >
              <Plus size={12} /> Ajouter une ligne
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
