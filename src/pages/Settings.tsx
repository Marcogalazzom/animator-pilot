import { useState, useEffect, useCallback } from 'react';
import {
  Building2, BarChart3, Bell, Database, Info,
  Save, CheckCircle2, ChevronDown, ChevronUp,
  FolderOpen, HardDrive,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

import {
  getSetting, setSetting,
  getKpiThresholds, setKpiThreshold,
} from '@/db';
import { getDb } from '@/db/database';
import type { KpiThreshold, ThresholdDirection } from '@/db/types';
import {
  INDICATOR_META, CATEGORY_LABELS,
  type IndicatorMeta,
} from './kpis/useKpisData';
import type { KpiCategory } from '@/db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThresholdForm {
  warning:   string;
  critical:  string;
  direction: ThresholdDirection;
}

type ToastKind = 'success' | 'error';

interface DbStats {
  kpiEntries:  number;
  projects:    number;
  imports:     number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: KpiCategory[] = ['occupation', 'finance', 'rh', 'qualite'];

const CATEGORY_ICON_MAP: Record<KpiCategory, string> = {
  occupation: '🏥',
  finance:    '💶',
  rh:         '👥',
  qualite:    '⭐',
};

// ─── Shared card shell ────────────────────────────────────────────────────────

interface SectionCardProps {
  icon:     React.ReactNode;
  title:    string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function SectionCard({ icon, title, children, defaultOpen = true }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      background:   'var(--color-surface)',
      borderRadius: '8px',
      boxShadow:    '0 1px 4px rgba(30,41,59,0.07)',
      overflow:     'hidden',
      border:       '1px solid var(--color-border)',
    }}>
      {/* Header — clickable to collapse */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          gap:            '10px',
          padding:        '16px 24px',
          background:     'none',
          border:         'none',
          borderBottom:   open ? '1px solid var(--color-border)' : 'none',
          cursor:         'pointer',
          textAlign:      'left',
          transition:     'background 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,64,175,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ color: 'var(--color-primary)', display: 'flex', flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize:   '15px',
          fontWeight: 600,
          color:      'var(--color-text-primary)',
          flex:       1,
        }}>
          {title}
        </span>
        <span style={{ color: 'var(--color-text-secondary)', display: 'flex' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Form field helpers ───────────────────────────────────────────────────────

interface FieldProps {
  label:    string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{
        fontSize:   '12px',
        fontWeight: 500,
        color:      'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.01em',
        textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

function TextInput({ hasError, style, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e  => { setFocused(false); props.onBlur?.(e); }}
      style={{
        fontFamily:   'var(--font-sans)',
        fontSize:     '14px',
        color:        'var(--color-text-primary)',
        background:   'var(--color-surface)',
        border:       `1px solid ${hasError ? 'var(--color-danger)' : focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: '6px',
        padding:      '8px 12px',
        outline:      'none',
        transition:   'border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow:    focused ? '0 0 0 3px rgba(30,64,175,0.12)' : 'none',
        width:        '100%',
        ...style,
      }}
    />
  );
}

// ─── Primary button ───────────────────────────────────────────────────────────

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?:  boolean;
  icon?:     React.ReactNode;
  children:  React.ReactNode;
  variant?:  'primary' | 'secondary';
}

function PrimaryButton({ loading, icon, children, variant = 'primary', style, ...props }: PrimaryButtonProps) {
  const [hovered, setHovered] = useState(false);

  const isPrimary = variant === 'primary';

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      onMouseEnter={e => { setHovered(true); props.onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); props.onMouseLeave?.(e); }}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             '6px',
        padding:         '8px 16px',
        backgroundColor: props.disabled || loading
          ? 'var(--color-border)'
          : isPrimary
            ? hovered ? '#1a35a0' : 'var(--color-primary)'
            : hovered ? 'rgba(30,64,175,0.08)' : 'transparent',
        color:           props.disabled || loading
          ? 'var(--color-text-secondary)'
          : isPrimary ? '#fff' : 'var(--color-primary)',
        border:          isPrimary ? 'none' : `1px solid var(--color-border)`,
        borderRadius:    '6px',
        fontSize:        '13px',
        fontWeight:      600,
        fontFamily:      'var(--font-sans)',
        cursor:          props.disabled || loading ? 'not-allowed' : 'pointer',
        transition:      'background-color 0.15s ease, color 0.15s ease',
        ...style,
      }}
    >
      {loading
        ? <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
        : icon
      }
      {children}
    </button>
  );
}

// ─── Direction toggle ─────────────────────────────────────────────────────────

interface DirectionToggleProps {
  value:    ThresholdDirection;
  onChange: (v: ThresholdDirection) => void;
}

function DirectionToggle({ value, onChange }: DirectionToggleProps) {
  return (
    <div style={{ display: 'flex', gap: '0', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      {(['above', 'below'] as ThresholdDirection[]).map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            flex:       1,
            padding:    '6px 10px',
            fontSize:   '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            border:     'none',
            cursor:     'pointer',
            transition: 'background 0.15s, color 0.15s',
            background: value === opt ? 'var(--color-primary)' : 'var(--color-surface)',
            color:      value === opt ? '#fff' : 'var(--color-text-secondary)',
          }}
        >
          {opt === 'above' ? '↑ Au-dessus' : '↓ En-dessous'}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  // ── Establishment state ──
  const [estabName,     setEstabName]     = useState('');
  const [bedCount,      setBedCount]      = useState('');
  const [savingEstab,   setSavingEstab]   = useState(false);

  // ── Thresholds state ──
  const [threshForms,   setThreshForms]   = useState<Record<string, ThresholdForm>>({});
  const [savingThresh,  setSavingThresh]  = useState<Record<string, boolean>>({});

  // ── DB stats ──
  const [dbStats, setDbStats] = useState<DbStats>({ kpiEntries: 0, projects: 0, imports: 0 });

  // ── Toast ──
  const addToast = useToastStore((s) => s.add);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    addToast(message, kind === 'error' ? 'error' : 'success');
  }, [addToast]);

  // ── Load on mount ──
  useEffect(() => {
    async function load() {
      try {
        const [name, beds, dbThresholds] = await Promise.all([
          getSetting('establishment_name').catch(() => ''),
          getSetting('bed_count').catch(() => ''),
          getKpiThresholds().catch(() => [] as KpiThreshold[]),
        ]);
        setEstabName(name ?? '');
        setBedCount(beds ?? '');

        // Build form state for each indicator that has a threshold
        const forms: Record<string, ThresholdForm> = {};
        for (const ind of INDICATOR_META) {
          const t = dbThresholds.find(t => t.indicator === ind.key);
          forms[ind.key] = {
            warning:   t?.warning  != null ? String(t.warning)  : '',
            critical:  t?.critical != null ? String(t.critical) : '',
            direction: t?.direction ?? (ind.upIsGood ? 'below' : 'above'),
          };
        }
        setThreshForms(forms);
      } catch (_) {
        // non-blocking — DB may not be available in web preview
      }

      // Load DB stats separately
      try {
        const db = await getDb();
        const [kpiRows, projRows, importRows] = await Promise.all([
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM kpi_entries', []),
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM projects', []),
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM import_history', []),
        ]);
        setDbStats({
          kpiEntries: kpiRows[0]?.cnt  ?? 0,
          projects:   projRows[0]?.cnt ?? 0,
          imports:    importRows[0]?.cnt ?? 0,
        });
      } catch (_) {
        // not critical
      }
    }
    load();
  }, []);

  // ── Save establishment ──
  const handleSaveEstab = useCallback(async () => {
    setSavingEstab(true);
    try {
      await Promise.all([
        setSetting('establishment_name', estabName.trim()),
        setSetting('bed_count', bedCount.trim()),
      ]);
      showToast('Paramètres enregistrés');
    } catch (_) {
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSavingEstab(false);
    }
  }, [estabName, bedCount, showToast]);

  // ── Save single threshold ──
  const handleSaveThreshold = useCallback(async (key: string) => {
    const form = threshForms[key];
    if (!form) return;

    setSavingThresh(prev => ({ ...prev, [key]: true }));
    try {
      await setKpiThreshold({
        indicator: key,
        warning:   form.warning  !== '' ? Number(form.warning)  : null,
        critical:  form.critical !== '' ? Number(form.critical) : null,
        direction: form.direction,
      });
      showToast(`Seuil « ${INDICATOR_META.find(m => m.key === key)?.label ?? key} » enregistré`);
    } catch (_) {
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSavingThresh(prev => ({ ...prev, [key]: false }));
    }
  }, [threshForms, showToast]);

  const updateThreshForm = useCallback((key: string, patch: Partial<ThresholdForm>) => {
    setThreshForms(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  // ── DB export message ──
  const [dbMsg, setDbMsg] = useState<string | null>(null);

  const handleExportDb = useCallback(() => {
    // plugin-dialog and plugin-fs are not bundled in this build.
    // Show the file location so the user can copy it manually.
    setDbMsg(
      "Le fichier de base de données se trouve dans le répertoire de données de l'application " +
      "(AppData/Roaming/com.ehpad-pilot/ehpad-pilot.db sur Windows)."
    );
  }, []);

  // ── Group indicators by category ──
  const indicatorsByCategory = INDICATOR_META.reduce<Record<KpiCategory, IndicatorMeta[]>>(
    (acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    },
    {} as Record<KpiCategory, IndicatorMeta[]>
  );

  return (
    <>
      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '20px',
        maxWidth:      '860px',
        paddingBottom: '40px',
      }}>

        {/* ── A. Page header ── */}
        <div style={{ marginBottom: '4px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize:   '24px',
            fontWeight: 700,
            color:      'var(--color-text-primary)',
            margin:     0,
            lineHeight: 1.2,
          }}>
            Paramètres
          </h1>
          <p style={{
            fontSize:   '14px',
            color:      'var(--color-text-secondary)',
            margin:     '4px 0 0',
            fontFamily: 'var(--font-sans)',
          }}>
            Configuration de votre établissement
          </p>
        </div>

        {/* ── B. Establishment ── */}
        <SectionCard icon={<Building2 size={18} />} title="Établissement">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Nom de l'établissement">
              <TextInput
                type="text"
                value={estabName}
                onChange={e => setEstabName(e.target.value)}
                placeholder="Mon EHPAD"
                onKeyDown={e => e.key === 'Enter' && handleSaveEstab()}
              />
            </Field>
            <Field label="Nombre de lits">
              <TextInput
                type="number"
                value={bedCount}
                onChange={e => setBedCount(e.target.value)}
                placeholder="80"
                min={1}
                onKeyDown={e => e.key === 'Enter' && handleSaveEstab()}
              />
            </Field>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton
              onClick={handleSaveEstab}
              loading={savingEstab}
              icon={<Save size={14} />}
            >
              Enregistrer
            </PrimaryButton>
          </div>
        </SectionCard>

        {/* ── C. Indicators ── */}
        <SectionCard icon={<BarChart3 size={18} />} title="Indicateurs suivis" defaultOpen={false}>
          <p style={{
            fontSize:   '13px',
            color:      'var(--color-text-secondary)',
            fontFamily: 'var(--font-sans)',
            margin:     '0 0 20px',
            lineHeight: 1.6,
          }}>
            Tous les indicateurs sont actuellement actifs. La sélection par indicateur sera disponible dans une prochaine version.
          </p>

          {CATEGORIES.map(cat => (
            <div key={cat} style={{ marginBottom: '20px' }}>
              {/* Category label */}
              <div style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '8px',
                marginBottom:   '10px',
                paddingBottom:  '8px',
                borderBottom:   '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: '16px' }}>{CATEGORY_ICON_MAP[cat]}</span>
                <span style={{
                  fontSize:   '13px',
                  fontWeight: 600,
                  color:      'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>

              <div style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap:                 '8px',
              }}>
                {(indicatorsByCategory[cat] ?? []).map(ind => (
                  <div
                    key={ind.key}
                    style={{
                      display:         'flex',
                      alignItems:      'center',
                      gap:             '10px',
                      padding:         '8px 12px',
                      borderRadius:    '6px',
                      border:          '1px solid var(--color-border)',
                      background:      'rgba(30,64,175,0.02)',
                    }}
                  >
                    {/* Pill — always enabled */}
                    <span style={{
                      width:           '8px',
                      height:          '8px',
                      borderRadius:    '50%',
                      backgroundColor: 'var(--color-success)',
                      flexShrink:      0,
                    }} />
                    <span style={{
                      fontSize:   '13px',
                      color:      'var(--color-text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                    }}>
                      {ind.label}
                    </span>
                    {ind.unit && (
                      <span style={{
                        marginLeft:  'auto',
                        fontSize:    '11px',
                        color:       'var(--color-text-secondary)',
                        fontFamily:  'var(--font-sans)',
                        flexShrink:  0,
                      }}>
                        {ind.unit.trim()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </SectionCard>

        {/* ── D. Thresholds ── */}
        <SectionCard icon={<Bell size={18} />} title="Seuils d'alerte">
          <p style={{
            fontSize:   '13px',
            color:      'var(--color-text-secondary)',
            fontFamily: 'var(--font-sans)',
            margin:     '0 0 20px',
            lineHeight: 1.6,
          }}>
            Définissez les valeurs de déclenchement des alertes pour chaque indicateur clé. Laissez vide pour désactiver un seuil.
          </p>

          {CATEGORIES.map(cat => (
            <div key={cat} style={{ marginBottom: '28px' }}>
              {/* Category divider */}
              <div style={{
                display:       'flex',
                alignItems:    'center',
                gap:           '8px',
                marginBottom:  '12px',
                paddingBottom: '8px',
                borderBottom:  '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: '15px' }}>{CATEGORY_ICON_MAP[cat]}</span>
                <span style={{
                  fontSize:      '12px',
                  fontWeight:    700,
                  color:         'var(--color-text-primary)',
                  fontFamily:    'var(--font-sans)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(indicatorsByCategory[cat] ?? []).map(ind => {
                  const form = threshForms[ind.key] ?? { warning: '', critical: '', direction: 'above' as ThresholdDirection };
                  const saving = savingThresh[ind.key] ?? false;

                  return (
                    <div
                      key={ind.key}
                      style={{
                        display:      'grid',
                        gridTemplate: '"label label label" auto "w c dir" auto "btn btn btn" auto / 1fr 1fr 1fr',
                        gap:          '10px 16px',
                        padding:      '14px 16px',
                        borderRadius: '8px',
                        border:       '1px solid var(--color-border)',
                        background:   'rgba(248,247,244,0.6)',
                      }}
                    >
                      {/* Indicator name */}
                      <div style={{ gridArea: 'label', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{
                          fontSize:   '13px',
                          fontWeight: 600,
                          color:      'var(--color-text-primary)',
                          fontFamily: 'var(--font-sans)',
                        }}>
                          {ind.label}
                        </span>
                        {ind.unit && (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                            ({ind.unit.trim()})
                          </span>
                        )}
                      </div>

                      {/* Warning */}
                      <div style={{ gridArea: 'w' }}>
                        <Field label="Attention">
                          <TextInput
                            type="number"
                            value={form.warning}
                            onChange={e => updateThreshForm(ind.key, { warning: e.target.value })}
                            placeholder="—"
                            step="any"
                            style={{ maxWidth: '100%' }}
                          />
                        </Field>
                      </div>

                      {/* Critical */}
                      <div style={{ gridArea: 'c' }}>
                        <Field label="Critique">
                          <TextInput
                            type="number"
                            value={form.critical}
                            onChange={e => updateThreshForm(ind.key, { critical: e.target.value })}
                            placeholder="—"
                            step="any"
                            style={{ maxWidth: '100%' }}
                          />
                        </Field>
                      </div>

                      {/* Direction */}
                      <div style={{ gridArea: 'dir' }}>
                        <Field label="Alerte si valeur est">
                          <DirectionToggle
                            value={form.direction}
                            onChange={dir => updateThreshForm(ind.key, { direction: dir })}
                          />
                        </Field>
                      </div>

                      {/* Save */}
                      <div style={{ gridArea: 'btn', display: 'flex', justifyContent: 'flex-end' }}>
                        <PrimaryButton
                          onClick={() => handleSaveThreshold(ind.key)}
                          loading={saving}
                          icon={<Save size={13} />}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          Enregistrer
                        </PrimaryButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </SectionCard>

        {/* ── E. Database ── */}
        <SectionCard icon={<Database size={18} />} title="Base de données">
          {/* DB path info */}
          <div style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          '10px',
            padding:      '12px 14px',
            borderRadius: '6px',
            background:   'rgba(30,64,175,0.04)',
            border:       '1px solid rgba(30,64,175,0.12)',
            marginBottom: '20px',
          }}>
            <HardDrive size={16} style={{ color: 'var(--color-primary)', marginTop: '1px', flexShrink: 0 }} />
            <div>
              <p style={{
                margin:     0,
                fontSize:   '13px',
                fontWeight: 500,
                color:      'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
              }}>
                ehpad-pilot.db
              </p>
              <p style={{
                margin:     '3px 0 0',
                fontSize:   '12px',
                color:      'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}>
                Fichier SQLite stocké dans le répertoire de données de l'application
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap:                 '12px',
            marginBottom:        '20px',
          }}>
            {[
              { label: 'Entrées KPI',  value: dbStats.kpiEntries },
              { label: 'Projets',      value: dbStats.projects },
              { label: 'Imports',      value: dbStats.imports },
            ].map(({ label, value }) => (
              <div key={label} style={{
                textAlign:    'center',
                padding:      '14px 12px',
                borderRadius: '8px',
                border:       '1px solid var(--color-border)',
                background:   'var(--color-surface)',
              }}>
                <p style={{
                  margin:      0,
                  fontSize:    '26px',
                  fontWeight:  700,
                  fontFamily:  'var(--font-display)',
                  color:       'var(--color-primary)',
                  lineHeight:  1,
                }}>
                  {value.toLocaleString('fr-FR')}
                </p>
                <p style={{
                  margin:     '6px 0 0',
                  fontSize:   '12px',
                  color:      'var(--color-text-secondary)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Export button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <PrimaryButton
              onClick={handleExportDb}
              icon={<FolderOpen size={14} />}
              variant="secondary"
            >
              Exporter la base
            </PrimaryButton>
            {dbMsg && (
              <p style={{
                fontSize:   '12px',
                color:      'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
                margin:     0,
                flex:       1,
              }}>
                {dbMsg}
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── F. About ── */}
        <SectionCard icon={<Info size={18} />} title="À propos" defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* App identity */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '14px',
              padding:      '16px',
              borderRadius: '8px',
              background:   'rgba(30,64,175,0.03)',
              border:       '1px solid rgba(30,64,175,0.1)',
            }}>
              <div style={{
                width:          '44px',
                height:         '44px',
                borderRadius:   '10px',
                background:     'var(--color-primary)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
              }}>
                <span style={{
                  color:      '#fff',
                  fontSize:   '18px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  lineHeight: 1,
                }}>E</span>
              </div>
              <div>
                <p style={{
                  margin:     0,
                  fontSize:   '16px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color:      'var(--color-text-primary)',
                }}>
                  EHPAD Pilot
                </p>
                <p style={{
                  margin:     '2px 0 0',
                  fontSize:   '12px',
                  color:      'var(--color-text-secondary)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  v0.1.0
                </p>
              </div>
            </div>

            <p style={{
              margin:     0,
              fontSize:   '13px',
              color:      'var(--color-text-secondary)',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.7,
            }}>
              Outil de pilotage pour direction d'EHPAD — indicateurs, projets et suivi qualité en un seul outil.
            </p>

            {/* Privacy notice */}
            <div style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          '10px',
              padding:      '12px 14px',
              borderRadius: '6px',
              background:   'rgba(5,150,105,0.05)',
              border:       '1px solid rgba(5,150,105,0.2)',
            }}>
              <CheckCircle2 size={15} style={{ color: 'var(--color-success)', marginTop: '1px', flexShrink: 0 }} />
              <p style={{
                margin:     0,
                fontSize:   '13px',
                color:      'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.6,
              }}>
                Aucune donnée personnelle n'est stockée — uniquement des indicateurs agrégés.
              </p>
            </div>
          </div>
        </SectionCard>

      </div>

    </>
  );
}
