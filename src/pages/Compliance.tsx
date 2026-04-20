import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '@/stores/toastStore';
import {
  ShieldCheck, Calendar, FileText, Check,
  AlertTriangle, Clock, Plus, X, ChevronUp, ChevronDown,
  ArrowUpDown, Trash2, ExternalLink, FolderKanban,
} from 'lucide-react';
import { getProject, createProject } from '@/db';
import { useComplianceData } from './compliance/useComplianceData';
import type { ComplianceFilters } from './compliance/useComplianceData';
import type {
  ComplianceObligation,
  ObligationCategory,
  ObligationFrequency,
  ObligationStatus,
} from '@/db/types';

// ─── Constants ────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'calendar';
type SortField = 'title' | 'category' | 'frequency' | 'next_due_date' | 'status';
type SortDir   = 'asc' | 'desc';

const CATEGORY_META: Record<ObligationCategory, { label: string; color: string; bg: string }> = {
  governance:    { label: 'Gouvernance',    color: '#1E40AF', bg: '#EFF6FF' },
  quality:       { label: 'Qualité',        color: '#059669', bg: '#ECFDF5' },
  security:      { label: 'Sécurité',       color: '#D97706', bg: '#FFFBEB' },
  hr:            { label: 'RH',             color: '#7C3AED', bg: '#F5F3FF' },
  securite:      { label: 'Sécurité',       color: '#D97706', bg: '#FFFBEB' },
  hygiene:       { label: 'Hygiène',        color: '#0F766E', bg: '#F0FDFA' },
  soins:         { label: 'Soins',          color: '#EC4899', bg: '#FDF2F8' },
  droits_usagers:{ label: 'Droits usagers', color: '#0EA5E9', bg: '#F0F9FF' },
  administratif: { label: 'Administratif',  color: '#64748B', bg: '#F8FAFC' },
  other:         { label: 'Autre',          color: '#64748B', bg: '#F1F5F9' },
};

const STATUS_META: Record<ObligationStatus, { label: string; color: string; bg: string }> = {
  compliant:      { label: 'Conforme',        color: '#059669', bg: '#ECFDF5' },
  in_progress:    { label: 'En cours',        color: '#1E40AF', bg: '#EFF6FF' },
  non_compliant:  { label: 'Non conforme',    color: '#DC2626', bg: '#FEF2F2' },
  to_plan:        { label: 'À planifier',     color: '#64748B', bg: '#F1F5F9' },
  not_applicable: { label: 'Non applicable',  color: '#94A3B8', bg: '#F8FAFC' },
};

const FREQUENCY_LABELS: Record<ObligationFrequency, string> = {
  annual:        'Annuelle',
  biannual:      'Bisannuelle',
  triennial:     'Triennale',
  quinquennial:  'Quinquennale',
  permanent:     'Permanente',
  periodic:      'Périodique',
  quarterly:     'Trimestrielle',
  monthly:       'Mensuelle',
  one_time:      'Ponctuelle',
  continuous:    'Continue',
};

const MONTHS_FR = [
  'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.',
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-sans)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  background: 'var(--color-primary)',
  color: '#FFF',
  border: 'none',
  borderRadius: '7px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: '7px',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(o: ComplianceObligation): boolean {
  if (!o.next_due_date || o.status === 'compliant') return false;
  return new Date(o.next_due_date) < new Date(new Date().toDateString());
}

function conformityPct(compliant: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((compliant / total) * 100);
}

function conformityColor(pct: number): string {
  if (pct >= 80) return 'var(--color-success)';
  if (pct >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  sub?: string;
}

function StatCard({ icon, label, value, color, bg, sub }: StatCardProps) {
  return (
    <div style={{
      flex: '1 1 0',
      minWidth: '160px',
      background: 'var(--color-surface)',
      borderRadius: '10px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: '26px',
          fontWeight: 700,
          color,
          fontFamily: 'var(--font-display)',
          lineHeight: 1,
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          marginTop: '4px',
          fontWeight: 500,
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-sans)',
            marginTop: '2px',
            opacity: 0.7,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: ObligationCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: meta.bg,
      color: meta.color,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ObligationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: meta.bg,
      color: meta.color,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {status === 'compliant'     && <Check size={9} />}
      {status === 'non_compliant' && <AlertTriangle size={9} />}
      {status === 'in_progress'   && <Clock size={9} />}
      {meta.label}
    </span>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />;
}

// ─── Table View ───────────────────────────────────────────────────────────────

interface TableViewProps {
  obligations: ComplianceObligation[];
  onSelect: (o: ComplianceObligation) => void;
  selectedId: number | null;
}

function TableView({ obligations, onSelect, selectedId }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('next_due_date');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...obligations].sort((a, b) => {
      let va: string | null, vb: string | null;
      if (sortField === 'category')      { va = a.category;      vb = b.category; }
      else if (sortField === 'frequency'){ va = a.frequency;     vb = b.frequency; }
      else if (sortField === 'status')   { va = a.status;        vb = b.status; }
      else if (sortField === 'next_due_date') { va = a.next_due_date ?? '9999'; vb = b.next_due_date ?? '9999'; }
      else                               { va = a.title;         vb = b.title; }
      if (va === vb) return 0;
      const cmp = (va ?? '') < (vb ?? '') ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [obligations, sortField, sortDir]);

  const thStyle = (field: SortField): React.CSSProperties => ({
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: sortField === field ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
    background: 'var(--color-bg)',
    borderBottom: '1px solid var(--color-border)',
  });

  if (obligations.length === 0) {
    return (
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        padding: '48px 24px',
        textAlign: 'center',
      }}>
        <ShieldCheck size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.4, margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          Aucune obligation ne correspond aux filtres sélectionnés.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: '10px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle('title')} onClick={() => handleSort('title')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Obligation <SortIcon field="title" current={sortField} dir={sortDir} />
                </div>
              </th>
              <th style={thStyle('category')} onClick={() => handleSort('category')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Catégorie <SortIcon field="category" current={sortField} dir={sortDir} />
                </div>
              </th>
              <th style={thStyle('frequency')} onClick={() => handleSort('frequency')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Fréquence <SortIcon field="frequency" current={sortField} dir={sortDir} />
                </div>
              </th>
              <th style={thStyle('next_due_date')} onClick={() => handleSort('next_due_date')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Prochaine échéance <SortIcon field="next_due_date" current={sortField} dir={sortDir} />
                </div>
              </th>
              <th style={thStyle('status')} onClick={() => handleSort('status')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Statut <SortIcon field="status" current={sortField} dir={sortDir} />
                </div>
              </th>
              <th style={{ ...thStyle('title'), cursor: 'default' }}>Doc.</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o, idx) => {
              const overdue   = isOverdue(o);
              const isSelected = o.id === selectedId;
              return (
                <tr
                  key={o.id}
                  onClick={() => onSelect(o)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected
                      ? '#EFF6FF'
                      : idx % 2 === 0
                        ? 'var(--color-surface)'
                        : 'rgba(248,247,244,0.6)',
                    borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(30,64,175,0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        idx % 2 === 0 ? 'var(--color-surface)' : 'rgba(248,247,244,0.6)';
                    }
                  }}
                >
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: overdue ? 'var(--color-danger)' : 'var(--color-text-primary)',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1.3,
                    }}>
                      {overdue && (
                        <AlertTriangle size={12} style={{ color: 'var(--color-danger)', marginRight: '5px', verticalAlign: 'middle' }} />
                      )}
                      {o.title}
                    </div>
                    {o.description && (
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '320px',
                      }}>
                        {o.description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
                    <CategoryBadge category={o.category} />
                  </td>
                  <td style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}>
                    {FREQUENCY_LABELS[o.frequency]}
                  </td>
                  <td style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '12px',
                    fontWeight: overdue ? 700 : 400,
                    color: overdue ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatDate(o.next_due_date)}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                    {o.document_path ? (
                      <span title={o.document_path} style={{ color: 'var(--color-primary)', display: 'inline-flex' }}>
                        <FileText size={15} />
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-border)', display: 'inline-flex' }}>
                        <FileText size={15} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

interface CalendarViewProps {
  obligations: ComplianceObligation[];
  onSelect: (o: ComplianceObligation) => void;
}

function CalendarView({ obligations, onSelect }: CalendarViewProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  // Group obligations by month (use next_due_date)
  const byMonth = useMemo(() => {
    const map: Record<number, ComplianceObligation[]> = {};
    for (let i = 0; i < 12; i++) map[i] = [];
    obligations.forEach((o) => {
      if (!o.next_due_date) return;
      const d = new Date(o.next_due_date);
      if (d.getFullYear() === currentYear || d.getFullYear() === currentYear + 1) {
        const month = d.getMonth();
        if (map[month]) map[month].push(o);
      }
    });
    return map;
  }, [obligations, currentYear]);

  // Obligations with no due date
  const noDue = useMemo(() => obligations.filter((o) => !o.next_due_date), [obligations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Month grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
      }}>
        {MONTHS_FR.map((monthLabel, monthIdx) => {
          const items = byMonth[monthIdx] ?? [];
          const isPast   = monthIdx < currentMonth;
          const isCurrent = monthIdx === currentMonth;
          return (
            <div
              key={monthIdx}
              style={{
                background: isCurrent ? '#EFF6FF' : 'var(--color-surface)',
                borderRadius: '10px',
                border: isCurrent
                  ? '1.5px solid var(--color-primary)'
                  : '1px solid var(--color-border)',
                padding: '14px',
                opacity: isPast && items.length === 0 ? 0.55 : 1,
                minHeight: '110px',
              }}
            >
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                {isCurrent && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                )}
                {monthLabel}
                {items.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: isCurrent ? 'var(--color-primary)' : 'var(--color-border)',
                    color: isCurrent ? '#FFF' : 'var(--color-text-secondary)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}>
                    {items.length}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {items.slice(0, 4).map((o) => {
                  const catMeta = CATEGORY_META[o.category];
                  const overdue = isOverdue(o);
                  return (
                    <button
                      key={o.id}
                      onClick={() => onSelect(o)}
                      title={o.title}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 6px',
                        background: overdue ? '#FEF2F2' : catMeta.bg,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: overdue ? 'var(--color-danger)' : catMeta.color,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: overdue ? 'var(--color-danger)' : catMeta.color,
                        fontFamily: 'var(--font-sans)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}>
                        {o.title}
                      </span>
                    </button>
                  );
                })}
                {items.length > 4 && (
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    paddingLeft: '4px',
                  }}>
                    +{items.length - 4} de plus
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Catégories :
        </span>
        {(Object.entries(CATEGORY_META) as [ObligationCategory, typeof CATEGORY_META[ObligationCategory]][]).map(([key, meta]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: meta.color, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{meta.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} />
          <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>En retard</span>
        </div>
      </div>

      {/* No due date obligations */}
      {noDue.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '10px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Sans échéance fixe ({noDue.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {noDue.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelect(o)}
                style={{
                  padding: '4px 10px',
                  background: CATEGORY_META[o.category].bg,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: CATEGORY_META[o.category].color,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {o.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreate: (data: Omit<ComplianceObligation, 'id' | 'created_at'>) => Promise<void>;
}

function CreateModal({ onClose, onCreate }: CreateModalProps) {
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState<ObligationCategory>('governance');
  const [frequency, setFreq]    = useState<ObligationFrequency>('annual');
  const [description, setDesc]  = useState('');
  const [dueDate, setDue]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Le titre est requis.'); return; }
    setSaving(true);
    try {
      await onCreate({
        title:               title.trim(),
        category,
        frequency,
        description:         description.trim(),
        status:              'to_plan',
        next_due_date:       dueDate || null,
        last_validated_date: null,
        document_path:       null,
        linked_project_id:   null,
        is_builtin:          0,
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        width: '100%',
        maxWidth: '500px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Nouvelle obligation
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid #DC2626', borderRadius: '6px', fontSize: '13px', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Intitulé de l'obligation" autoFocus style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Catégorie</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ObligationCategory)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {(Object.entries(CATEGORY_META) as [ObligationCategory, typeof CATEGORY_META[ObligationCategory]][]).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Fréquence</label>
              <select value={frequency} onChange={(e) => setFreq(e.target.value as ObligationFrequency)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {(Object.entries(FREQUENCY_LABELS) as [ObligationFrequency, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Description de l'obligation..." rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Prochaine échéance</label>
            <input type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>Annuler</button>
            <button type="submit" disabled={saving} style={primaryBtnStyle}>
              {saving ? 'Création...' : 'Créer l\'obligation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  obligation: ComplianceObligation;
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<ComplianceObligation>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onMarkCompliant: (id: number) => Promise<void>;
}

function DetailPanel({ obligation, onClose, onUpdate, onDelete, onMarkCompliant }: DetailPanelProps) {
  const [editTitle, setEditTitle]   = useState(obligation.title);
  const [editDesc, setEditDesc]     = useState(obligation.description ?? '');
  const [editCategory, setCategory] = useState<ObligationCategory>(obligation.category);
  const [editFreq, setFreq]         = useState<ObligationFrequency>(obligation.frequency);
  const [editStatus, setStatus]     = useState<ObligationStatus>(obligation.status);
  const [editDue, setDue]           = useState(obligation.next_due_date ?? '');
  const [editDocPath, setDocPath]   = useState(obligation.document_path ?? '');
  const [saving, setSaving]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [marking, setMarking]       = useState(false);
  const [linkedProjectTitle, setLinkedProjectTitle] = useState<string | null>(null);
  const [linkingProject, setLinkingProject] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (obligation.linked_project_id) {
      getProject(obligation.linked_project_id).then((p) => {
        setLinkedProjectTitle(p ? p.title : null);
      });
    } else {
      setLinkedProjectTitle(null);
    }
  }, [obligation.linked_project_id]);

  async function handleCreateLinkedProject() {
    setLinkingProject(true);
    try {
      const newId = await createProject({
        title: obligation.title,
        description: '',
        owner_role: '',
        status: 'todo',
        start_date: null,
        due_date: null,
        category: '',
        next_action: '',
      });
      await onUpdate(obligation.id, { linked_project_id: newId });
      const proj = await getProject(newId);
      setLinkedProjectTitle(proj ? proj.title : obligation.title);
    } finally {
      setLinkingProject(false);
    }
  }

  async function handleUnlinkProject() {
    await onUpdate(obligation.id, { linked_project_id: null });
    setLinkedProjectTitle(null);
  }

  const catMeta = CATEGORY_META[editCategory];
  const overdue = isOverdue(obligation);

  async function saveField(updates: Partial<ComplianceObligation>) {
    setSaving(true);
    try {
      await onUpdate(obligation.id, updates);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCompliant() {
    setMarking(true);
    try {
      await onMarkCompliant(obligation.id);
      setStatus('compliant');
    } finally {
      setMarking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(obligation.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0, bottom: 0,
      width: '480px',
      maxWidth: '100vw',
      background: 'var(--color-surface)',
      boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '4px',
          height: '40px',
          borderRadius: '2px',
          background: catMeta.color,
          flexShrink: 0,
          marginTop: '2px',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => saveField({ title: editTitle.trim() || obligation.title })}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              padding: 0,
              lineHeight: 1.3,
            }}
          />
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusBadge status={editStatus} />
            {overdue && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                En retard
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {saving && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
              Enreg...
            </span>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Mark compliant CTA */}
        {obligation.status !== 'compliant' && (
          <button
            onClick={handleMarkCompliant}
            disabled={marking}
            style={{
              ...primaryBtnStyle,
              width: '100%',
              justifyContent: 'center',
              padding: '10px 16px',
              background: marking ? 'var(--color-border)' : 'var(--color-success)',
            }}
          >
            <Check size={15} />
            {marking ? 'Enregistrement...' : 'Marquer conforme'}
          </button>
        )}

        {/* Last validated */}
        {obligation.last_validated_date && (
          <div style={{
            padding: '10px 14px',
            background: '#ECFDF5',
            borderRadius: '8px',
            border: '1px solid rgba(5,150,105,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Check size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--color-success)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
              Dernière validation : {formatDate(obligation.last_validated_date)}
            </span>
          </div>
        )}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Statut</label>
            <select
              value={editStatus}
              onChange={(e) => {
                const newStatus = e.target.value as ObligationStatus;
                setStatus(newStatus);
                saveField({ status: newStatus });
              }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {(Object.entries(STATUS_META) as [ObligationStatus, typeof STATUS_META[ObligationStatus]][]).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Catégorie</label>
            <select
              value={editCategory}
              onChange={(e) => {
                const newCat = e.target.value as ObligationCategory;
                setCategory(newCat);
                saveField({ category: newCat });
              }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {(Object.entries(CATEGORY_META) as [ObligationCategory, typeof CATEGORY_META[ObligationCategory]][]).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          {/* Frequency */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Fréquence</label>
            <select
              value={editFreq}
              onChange={(e) => {
                const newFreq = e.target.value as ObligationFrequency;
                setFreq(newFreq);
                saveField({ frequency: newFreq });
              }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {(Object.entries(FREQUENCY_LABELS) as [ObligationFrequency, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={() => saveField({ description: editDesc.trim() })}
              placeholder="Description de l'obligation..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Next due date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Prochaine échéance</label>
            <input
              type="date"
              value={editDue}
              onChange={(e) => setDue(e.target.value)}
              onBlur={() => saveField({ next_due_date: editDue || null })}
              style={inputStyle}
            />
          </div>

          {/* Document path */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Lien document</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={editDocPath}
                onChange={(e) => setDocPath(e.target.value)}
                onBlur={() => saveField({ document_path: editDocPath.trim() || null })}
                placeholder="Chemin ou URL du document..."
                style={{ ...inputStyle, flex: 1 }}
              />
              {editDocPath && (
                <button
                  title="Ouvrir le document"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 10px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    flexShrink: 0,
                  }}
                >
                  <ExternalLink size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Projet lié */}
        <div style={{
          borderRadius: '8px',
          border: obligation.linked_project_id
            ? '1px solid rgba(22, 163, 74, 0.35)'
            : '1px dashed var(--color-border)',
          borderLeft: obligation.linked_project_id
            ? '3px solid #16A34A'
            : '3px dashed var(--color-border)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: obligation.linked_project_id ? 'rgba(22,163,74,0.04)' : 'var(--color-bg)',
        }}>
          <FolderKanban size={15} style={{ color: obligation.linked_project_id ? '#16A34A' : 'var(--color-text-secondary)', flexShrink: 0 }} />
          {obligation.linked_project_id && linkedProjectTitle !== null ? (
            <>
              <button
                onClick={() => navigate('/projects')}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: '#16A34A' }}
              >
                {linkedProjectTitle}
              </button>
              <button
                onClick={handleUnlinkProject}
                title="Délier le projet"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={handleCreateLinkedProject}
              disabled={linkingProject}
              style={{
                flex: 1,
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '5px',
                cursor: 'pointer',
                padding: '5px 10px',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Plus size={12} />
              {linkingProject ? 'Création...' : 'Créer un projet lié'}
            </button>
          )}
        </div>

        {/* Metadata */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {obligation.is_builtin === 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={12} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                Obligation réglementaire intégrée
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={12} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
              Créée le {formatDate(obligation.created_at)}
            </span>
          </div>
        </div>

        {/* Delete (only for non-builtin) */}
        {obligation.is_builtin === 0 && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  ...secondaryBtnStyle,
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(220,38,38,0.3)',
                }}
              >
                <Trash2 size={14} />
                Supprimer l'obligation
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '13px', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', margin: 0, fontWeight: 500 }}>
                  Confirmer la suppression ?
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ ...primaryBtnStyle, background: 'var(--color-danger)' }}
                  >
                    {deleting ? 'Suppression...' : 'Oui, supprimer'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={secondaryBtnStyle}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filters Bar ──────────────────────────────────────────────────────────────

interface FiltersBarProps {
  filters: ComplianceFilters;
  onChange: (f: ComplianceFilters) => void;
  count: number;
  total: number;
}

function FiltersBar({ filters, onChange, count, total }: FiltersBarProps) {
  const filterBtnBase: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    transition: 'all 0.1s ease',
  };

  const activeFilterBtn: React.CSSProperties = {
    ...filterBtnBase,
    background: '#EFF6FF',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-primary)',
    fontWeight: 600,
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: '10px',
      border: '1px solid var(--color-border)',
      padding: '12px 16px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
    }}>
      {/* Category filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Catégorie :
        </span>
        <button onClick={() => onChange({ ...filters, category: '' })} style={!filters.category ? activeFilterBtn : filterBtnBase}>
          Toutes
        </button>
        {(Object.entries(CATEGORY_META) as [ObligationCategory, typeof CATEGORY_META[ObligationCategory]][]).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => onChange({ ...filters, category: key })}
            style={filters.category === key ? { ...activeFilterBtn, color: meta.color, border: `1px solid ${meta.color}`, background: meta.bg } : filterBtnBase}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', flexShrink: 0 }} />

      {/* Status filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Statut :
        </span>
        <button onClick={() => onChange({ ...filters, status: '' })} style={!filters.status ? activeFilterBtn : filterBtnBase}>
          Tous
        </button>
        {(Object.entries(STATUS_META) as [ObligationStatus, typeof STATUS_META[ObligationStatus]][]).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => onChange({ ...filters, status: key })}
            style={filters.status === key ? { ...activeFilterBtn, color: meta.color, border: `1px solid ${meta.color}`, background: meta.bg } : filterBtnBase}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', flexShrink: 0 }} />

      {/* Due range filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Échéance :
        </span>
        {([['', 'Toutes'], ['30', '30 jours'], ['60', '60 jours'], ['90', '90 jours']] as [ComplianceFilters['dueRange'], string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => onChange({ ...filters, dueRange: val })}
            style={filters.dueRange === val ? activeFilterBtn : filterBtnBase}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Result count */}
      <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
        {count === total ? `${total} obligation${total !== 1 ? 's' : ''}` : `${count} / ${total}`}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Compliance() {
  const {
    obligations,
    filteredObligations,
    stats,
    loading,
    filters,
    setFilters,
    selectedObligation,
    selectObligation,
    createObligation,
    updateObligation,
    deleteObligation,
    markCompliant,
  } = useComplianceData();

  const addToast = useToastStore((s) => s.add);
  const [viewMode, setViewMode]     = useState<ViewMode>('table');
  const [showCreate, setShowCreate] = useState(false);

  const pct = conformityPct(stats.compliant, stats.total);

  const handleUpdateCallback = useCallback(
    (id: number, updates: Partial<ComplianceObligation>) => updateObligation(id, updates),
    [updateObligation]
  );

  const handleDeleteCallback = useCallback(
    async (id: number) => {
      await deleteObligation(id);
      addToast('Obligation supprimée', 'success');
    },
    [deleteObligation, addToast]
  );

  const handleCreateObligation = useCallback(
    async (data: Parameters<typeof createObligation>[0]) => {
      await createObligation(data);
      addToast('Obligation créée', 'success');
    },
    [createObligation, addToast]
  );

  const handleMarkCompliantCallback = useCallback(
    (id: number) => markCompliant(id),
    [markCompliant]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

      {/* Page header */}
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
            Conformité réglementaire
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            margin: '4px 0 0',
            fontFamily: 'var(--font-sans)',
          }}>
            Suivi des obligations réglementaires de l'établissement
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={primaryBtnStyle}
        >
          <Plus size={15} />
          Nouvelle obligation
        </button>
      </div>

      {/* Stats row */}
      {loading ? (
        <div style={{
          display: 'flex',
          gap: '12px',
        }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              flex: '1 1 0',
              height: '96px',
              background: 'var(--color-surface)',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <StatCard
            icon={<ShieldCheck size={18} />}
            label="Taux de conformité"
            value={`${pct}%`}
            color={conformityColor(pct)}
            bg={pct >= 80 ? '#ECFDF5' : pct >= 50 ? '#FFFBEB' : '#FEF2F2'}
            sub={`${stats.compliant} sur ${stats.total} obligations`}
          />
          <StatCard
            icon={<Check size={18} />}
            label="Obligations conformes"
            value={stats.compliant}
            color="var(--color-success)"
            bg="#ECFDF5"
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="En retard"
            value={stats.overdue}
            color={stats.overdue > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
            bg={stats.overdue > 0 ? '#FEF2F2' : '#ECFDF5'}
            sub={stats.overdue > 0 ? 'À traiter en priorité' : undefined}
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Prochains 30 jours"
            value={stats.upcoming30}
            color={stats.upcoming30 > 0 ? 'var(--color-warning)' : 'var(--color-text-secondary)'}
            bg={stats.upcoming30 > 0 ? '#FFFBEB' : '#F1F5F9'}
            sub={stats.upcoming30 > 0 ? 'Échéances imminentes' : undefined}
          />
        </div>
      )}

      {/* Filters */}
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        count={filteredObligations.length}
        total={obligations.length}
      />

      {/* View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          padding: '3px',
          gap: '2px',
        }}>
          {([
            { key: 'table',    label: 'Tableau',    icon: <ArrowUpDown size={14} /> },
            { key: 'calendar', label: 'Calendrier', icon: <Calendar size={14} /> },
          ] as { key: ViewMode; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === key ? 'var(--color-primary)' : 'transparent',
                color: viewMode === key ? '#FFF' : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Active filters summary */}
        {(filters.category || filters.status || filters.dueRange) && (
          <button
            onClick={() => setFilters({ category: '', status: '', dueRange: '' })}
            style={{
              ...secondaryBtnStyle,
              fontSize: '11px',
              padding: '5px 10px',
            }}
          >
            <X size={12} />
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Content view */}
      {viewMode === 'table' ? (
        <TableView
          obligations={filteredObligations}
          onSelect={selectObligation}
          selectedId={selectedObligation?.id ?? null}
        />
      ) : (
        <CalendarView
          obligations={filteredObligations}
          onSelect={selectObligation}
        />
      )}

      {/* Overlay when panel is open */}
      {selectedObligation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 39,
            background: 'rgba(0,0,0,0.08)',
          }}
          onClick={() => selectObligation(null)}
        />
      )}

      {/* Detail panel */}
      {selectedObligation && (
        <DetailPanel
          obligation={selectedObligation}
          onClose={() => selectObligation(null)}
          onUpdate={handleUpdateCallback}
          onDelete={handleDeleteCallback}
          onMarkCompliant={handleMarkCompliantCallback}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateObligation}
        />
      )}
    </div>
  );
}
