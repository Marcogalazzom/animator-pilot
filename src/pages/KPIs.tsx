import { useState, useMemo, useCallback, useId } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  BedDouble, Euro, Users, Star,
  TrendingUp, TrendingDown, Minus,
  Plus, Settings2, X, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';

import { addKpiEntry, setKpiThreshold } from '@/db';
import type { KpiCategory } from '@/db/types';
import {
  useKpisData,
  buildChartData,
  computeStatus,
  INDICATOR_META,
  CATEGORY_LABELS,
  MOCK_ENTRIES,
  MOCK_THRESHOLDS,
  type KpiStatus,
  type ChartPoint,
} from './kpis/useKpisData';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: KpiCategory[] = ['occupation', 'finance', 'rh', 'qualite'];

const CATEGORY_ICONS: Record<KpiCategory, typeof BedDouble> = {
  occupation: BedDouble,
  finance:    Euro,
  rh:         Users,
  qualite:    Star,
};

const STATUS_COLOR: Record<KpiStatus, string> = {
  ok:       'var(--color-success)',
  warning:  'var(--color-warning)',
  critical: 'var(--color-danger)',
  neutral:  'var(--color-text-secondary)',
};

const STATUS_BG: Record<KpiStatus, string> = {
  ok:       'rgba(5,150,105,0.08)',
  warning:  'rgba(217,119,6,0.08)',
  critical: 'rgba(220,38,38,0.08)',
  neutral:  'rgba(100,116,139,0.08)',
};

const STATUS_LABELS: Record<KpiStatus, string> = {
  ok:       'OK',
  warning:  'Attention',
  critical: 'Critique',
  neutral:  '—',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number, unit: string): string {
  if (unit === '%' || unit === '/10') return value.toFixed(1);
  if (unit === ' k€' || unit === ' €') return value.toFixed(0);
  if (unit === '') return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
  return value.toFixed(1);
}

function trendDir(current: number, previous: number): 'up' | 'down' | 'neutral' {
  const diff = current - previous;
  if (Math.abs(diff) < 0.001) return 'neutral';
  return diff > 0 ? 'up' : 'down';
}

function trendPct(current: number, previous: number): string {
  if (previous === 0) return '—';
  const delta = ((current - previous) / previous) * 100;
  return (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: KpiStatus;
}
function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = status === 'ok' ? CheckCircle2 : status === 'warning' ? AlertTriangle : status === 'critical' ? XCircle : Minus;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      fontFamily: 'var(--font-sans)',
      letterSpacing: '0.02em',
      color: STATUS_COLOR[status],
      backgroundColor: STATUS_BG[status],
    }}>
      <Icon size={10} strokeWidth={2.5} />
      {STATUS_LABELS[status]}
    </span>
  );
}

interface TrendCellProps {
  current: number;
  previous: number;
  upIsGood: boolean;
}
function TrendCell({ current, previous, upIsGood }: TrendCellProps) {
  const dir = trendDir(current, previous);
  const pct = trendPct(current, previous);

  let color = 'var(--color-text-secondary)';
  if (dir === 'up')   color = upIsGood ? 'var(--color-success)' : 'var(--color-danger)';
  if (dir === 'down') color = upIsGood ? 'var(--color-danger)'  : 'var(--color-success)';

  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      color,
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: 'var(--font-sans)',
    }}>
      <Icon size={13} strokeWidth={2.5} />
      {pct}
    </span>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>;
  label?: string;
  unit: string;
}
function ChartTooltip({ active, payload, label, unit }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      padding: '8px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      fontFamily: 'var(--font-sans)',
      minWidth: '120px',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        p.value != null && (
          <p key={i} style={{ margin: '2px 0', fontSize: '13px', fontWeight: 700, color: p.color }}>
            {p.name}: {p.value}{unit}
          </p>
        )
      ))}
    </div>
  );
}

// ─── Add value modal ──────────────────────────────────────────────────────────

interface AddValueModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultIndicator?: string;
}

function AddValueModal({ open, onClose, onSaved, defaultIndicator }: AddValueModalProps) {
  const [indicator, setIndicator] = useState(defaultIndicator ?? INDICATOR_META[0].key);
  const [value,     setValue]     = useState('');
  const [period,    setPeriod]    = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const selectedMeta = INDICATOR_META.find(m => m.key === indicator) ?? INDICATOR_META[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num)) { setErr('Valeur invalide'); return; }
    if (!/^\d{4}-\d{2}$/.test(period)) { setErr('Format période invalide (YYYY-MM)'); return; }
    setSaving(true);
    try {
      await addKpiEntry({
        category:  selectedMeta.category,
        indicator,
        value:     num,
        period,
        source:    'manual',
      });
      onSaved();
      onClose();
      setValue('');
      setErr('');
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          width: '420px',
          maxWidth: '90vw',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          padding: '18px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: 'rgba(30,64,175,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={16} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}>
              Saisir une valeur
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-secondary)', padding: '4px',
              borderRadius: '4px', display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Indicator select */}
            <div>
              <label style={labelStyle}>Indicateur</label>
              <select
                value={indicator}
                onChange={e => setIndicator(e.target.value)}
                style={inputStyle}
              >
                {CATEGORIES.map(cat => (
                  <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                    {INDICATOR_META.filter(m => m.category === cat).map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Value input */}
            <div>
              <label style={labelStyle}>
                Valeur
                {selectedMeta.unit && (
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: '4px' }}>
                    ({selectedMeta.unit.trim()})
                  </span>
                )}
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="ex: 94.2"
                required
                style={inputStyle}
              />
            </div>

            {/* Period input */}
            <div>
              <label style={labelStyle}>Période</label>
              <input
                type="text"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder="YYYY-MM"
                pattern="\d{4}-\d{2}"
                required
                style={inputStyle}
              />
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                Format : YYYY-MM (ex: 2026-04)
              </p>
            </div>

            {/* Error */}
            {err && (
              <div style={{
                backgroundColor: 'rgba(220,38,38,0.06)',
                border: '1px solid var(--color-danger)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--color-danger)',
                fontFamily: 'var(--font-sans)',
              }}>
                {err}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={onClose} style={secondaryBtnStyle}>
                Annuler
              </button>
              <button type="submit" disabled={saving} style={primaryBtnStyle}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Threshold panel ──────────────────────────────────────────────────────────

interface ThresholdPanelProps {
  open: boolean;
  indicators: typeof INDICATOR_META;
  thresholds: Array<{ id: number; indicator: string; warning: number | null; critical: number | null; direction: 'above' | 'below' }>;
  onSaved: () => void;
}

function ThresholdPanel({ open, indicators, thresholds, onSaved }: ThresholdPanelProps) {
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(key: string, warning: string, critical: string, direction: 'above' | 'below') {
    setSaving(key);
    try {
      await setKpiThreshold({
        indicator: key,
        warning:   warning  ? parseFloat(warning)  : null,
        critical:  critical ? parseFloat(critical) : null,
        direction,
      });
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  if (!open) return null;

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Settings2 size={15} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
        }}>
          Configuration des seuils
        </span>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {indicators.map(meta => {
          const threshold = thresholds.find(t => t.indicator === meta.key);
          return (
            <ThresholdRow
              key={meta.key}
              meta={meta}
              threshold={threshold}
              saving={saving === meta.key}
              onSave={(warning, critical, direction) => handleSave(meta.key, warning, critical, direction)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ThresholdRowProps {
  meta: typeof INDICATOR_META[0];
  threshold?: { warning: number | null; critical: number | null; direction: 'above' | 'below' };
  saving: boolean;
  onSave: (warning: string, critical: string, direction: 'above' | 'below') => void;
}

function ThresholdRow({ meta, threshold, saving, onSave }: ThresholdRowProps) {
  const [warning,   setWarning]   = useState(String(threshold?.warning  ?? ''));
  const [critical,  setCritical]  = useState(String(threshold?.critical ?? ''));
  const [direction, setDirection] = useState<'above' | 'below'>(threshold?.direction ?? (meta.upIsGood ? 'below' : 'above'));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 100px 100px 120px 80px',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 12px',
      borderRadius: '6px',
      backgroundColor: 'rgba(0,0,0,0.015)',
    }}>
      <span style={{
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {meta.label}
      </span>
      <input
        type="number"
        step="any"
        value={warning}
        onChange={e => setWarning(e.target.value)}
        placeholder="Attention"
        style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
      />
      <input
        type="number"
        step="any"
        value={critical}
        onChange={e => setCritical(e.target.value)}
        placeholder="Critique"
        style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
      />
      <select
        value={direction}
        onChange={e => setDirection(e.target.value as 'above' | 'below')}
        style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
      >
        <option value="above">Si supérieur</option>
        <option value="below">Si inférieur</option>
      </select>
      <button
        onClick={() => onSave(warning, critical, direction)}
        disabled={saving}
        style={{
          ...primaryBtnStyle,
          padding: '5px 10px',
          fontSize: '11px',
          width: '100%',
        }}
      >
        {saving ? '…' : 'Sauver'}
      </button>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-sans)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '9px 18px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  color: '#fff',
  backgroundColor: 'var(--color-primary)',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 18px',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-secondary)',
  backgroundColor: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  cursor: 'pointer',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function KPIs() {
  const [activeCategory,    setActiveCategory]    = useState<KpiCategory>('occupation');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('taux_occupation');
  const [addModalOpen,      setAddModalOpen]       = useState(false);
  const [thresholdOpen,     setThresholdOpen]      = useState(false);
  const [sortKey,           setSortKey]            = useState<'label' | 'value' | null>(null);
  const [sortDir,           setSortDir]            = useState<'asc' | 'desc'>('asc');
  const gradientId = useId();

  const { entries, thresholds, loading, error, refresh } = useKpisData(activeCategory);

  // ── Derive table rows ──────────────────────────────────────────────────────

  const indicatorsForCategory = useMemo(
    () => INDICATOR_META.filter(m => m.category === activeCategory),
    [activeCategory]
  );

  interface TableRow {
    key: string;
    label: string;
    unit: string;
    current: number | null;
    previous: number | null;
    upIsGood: boolean;
    status: KpiStatus;
  }

  const tableRows = useMemo<TableRow[]>(() => {
    const rows = indicatorsForCategory.map(meta => {
      const byIndicator = entries.filter(e => e.indicator === meta.key);
      const sorted = [...byIndicator].sort((a, b) => b.period.localeCompare(a.period));
      const current  = sorted[0]?.value ?? null;
      const previous = sorted[1]?.value ?? null;
      const threshold = thresholds.find(t => t.indicator === meta.key);
      const status = current != null ? computeStatus(current, threshold) : 'neutral';

      return { key: meta.key, label: meta.label, unit: meta.unit, current, previous, upIsGood: meta.upIsGood, status };
    });

    if (!sortKey) return rows;

    return [...rows].sort((a, b) => {
      let va = sortKey === 'label' ? a.label : (a.current ?? -Infinity);
      let vb = sortKey === 'label' ? b.label : (b.current ?? -Infinity);
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [indicatorsForCategory, entries, thresholds, sortKey, sortDir]);

  // ── Chart data for selected indicator ─────────────────────────────────────

  const chartData = useMemo<ChartPoint[]>(() => {
    const indicatorEntries = entries.filter(e => e.indicator === selectedIndicator);
    if (indicatorEntries.length === 0) {
      // Fall back to mock
      const mock = (MOCK_ENTRIES[selectedIndicator] ?? []);
      return buildChartData(mock);
    }
    return buildChartData(indicatorEntries);
  }, [entries, selectedIndicator]);

  const selectedMeta = INDICATOR_META.find(m => m.key === selectedIndicator);

  // ── Sort helper ────────────────────────────────────────────────────────────

  const handleSort = useCallback((key: 'label' | 'value') => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  function SortIcon({ col }: { col: 'label' | 'value' }) {
    if (sortKey !== col) return <ChevronUp size={12} style={{ opacity: 0.2 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />;
  }

  // ── When category changes, select its first indicator ────────────────────

  function handleCategoryChange(cat: KpiCategory) {
    setActiveCategory(cat);
    const first = INDICATOR_META.find(m => m.category === cat);
    if (first) setSelectedIndicator(first.key);
    setSortKey(null);
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <div style={{ width: '220px', height: '28px', borderRadius: '6px', background: 'var(--color-border)', marginBottom: '8px' }} className="shimmer" />
          <div style={{ width: '300px', height: '16px', borderRadius: '4px', background: 'var(--color-border)' }} className="shimmer" />
        </div>
        <div style={{ height: '44px', borderRadius: '8px', background: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} className="shimmer" />
        <div style={{ height: '280px', borderRadius: '8px', background: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} className="shimmer" />
      </div>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>

      {/* ── A. Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.2,
          }}>
            Indicateurs
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            margin: '4px 0 0',
            fontFamily: 'var(--font-sans)',
          }}>
            Suivi détaillé par catégorie
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setThresholdOpen(o => !o)}
            style={{
              ...secondaryBtnStyle,
              padding: '8px 14px',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <Settings2 size={14} />
            Seuils
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            style={{
              ...primaryBtnStyle,
              gap: '6px',
            }}
          >
            <Plus size={14} />
            Saisir une valeur
          </button>
        </div>
      </div>

      {/* ── DB warning ── */}
      {error && (
        <div role="alert" style={{
          backgroundColor: 'rgba(217,119,6,0.06)',
          border: '1px solid var(--color-warning)',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '13px',
          color: 'var(--color-warning)',
          fontFamily: 'var(--font-sans)',
        }}>
          Données de démonstration — base de données non accessible.
        </div>
      )}

      {/* ── B. Category tabs ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '0 4px',
        display: 'flex',
        gap: '0',
        overflow: 'hidden',
      }}>
        {CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat];
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '13px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'var(--font-sans)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                transition: 'color 0.15s, border-color 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* ── C. Indicators table ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {[
                { key: 'label',   label: 'Indicateur',       sortable: true  },
                { key: 'value',   label: 'Valeur actuelle',  sortable: true  },
                { key: 'prev',    label: 'Mois précédent',   sortable: false },
                { key: 'trend',   label: 'Tendance',         sortable: false },
                { key: 'status',  label: 'Seuil',            sortable: false },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key as 'label' | 'value') : undefined}
                  style={{
                    padding: '11px 16px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    backgroundColor: 'rgba(0,0,0,0.015)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {col.label}
                    {col.sortable && <SortIcon col={col.key as 'label' | 'value'} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => {
              const isSelected = row.key === selectedIndicator;
              return (
                <tr
                  key={row.key}
                  onClick={() => setSelectedIndicator(row.key)}
                  style={{
                    borderBottom: i < tableRows.length - 1 ? '1px solid var(--color-border)' : 'none',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'rgba(30,64,175,0.04)'
                      : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)',
                    transition: 'background-color 0.1s',
                  }}
                >
                  {/* Indicateur */}
                  <td style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isSelected && (
                        <span style={{
                          display: 'inline-block',
                          width: '3px',
                          height: '16px',
                          borderRadius: '2px',
                          backgroundColor: 'var(--color-primary)',
                          flexShrink: 0,
                        }} />
                      )}
                      {row.label}
                    </span>
                  </td>

                  {/* Valeur actuelle */}
                  <td style={{
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.01em',
                  }}>
                    {row.current != null
                      ? `${fmt(row.current, row.unit)}${row.unit}`
                      : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    }
                  </td>

                  {/* Mois précédent */}
                  <td style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--color-text-secondary)',
                  }}>
                    {row.previous != null
                      ? `${fmt(row.previous, row.unit)}${row.unit}`
                      : '—'
                    }
                  </td>

                  {/* Tendance */}
                  <td style={{ padding: '12px 16px' }}>
                    {row.current != null && row.previous != null
                      ? <TrendCell current={row.current} previous={row.previous} upIsGood={row.upIsGood} />
                      : <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>—</span>
                    }
                  </td>

                  {/* Seuil / Status */}
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── D. Chart panel ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '20px',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: '0 0 3px',
          }}>
            {selectedMeta?.label ?? selectedIndicator}
          </h2>
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            margin: 0,
            fontFamily: 'var(--font-sans)',
          }}>
            Évolution mensuelle — {currentYear} vs {currentYear - 1}
          </p>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 24, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#1E40AF" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}${selectedMeta?.unit?.trim() ?? ''}`}
              width={48}
            />
            <Tooltip
              content={<ChartTooltip unit={selectedMeta?.unit ?? ''} />}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                paddingBottom: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="current"
              name={String(currentYear)}
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--color-primary)', stroke: '#fff', strokeWidth: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="previous"
              name={String(currentYear - 1)}
              stroke="#94A3B8"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4, fill: '#94A3B8', stroke: '#fff', strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── F. Threshold configuration (collapsible) ── */}
      <ThresholdPanel
        open={thresholdOpen}
        indicators={indicatorsForCategory}
        thresholds={thresholds.length > 0 ? thresholds : MOCK_THRESHOLDS}
        onSaved={refresh}
      />

      {/* ── E. Add value modal ── */}
      <AddValueModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSaved={refresh}
        defaultIndicator={selectedIndicator}
      />

    </div>
  );
}
