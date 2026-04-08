import { useState, useRef, useEffect, useCallback, type DragEvent, type ChangeEvent } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, Clock, FileCheck,
  Loader2, RotateCcw,
} from 'lucide-react';

import { addKpiEntry, getImportHistory, addImportRecord } from '@/db';
import type { ImportRecord } from '@/db/types';
import { INDICATOR_META } from './kpis/useKpisData';
import {
  parseFile,
  autoDetectMappings,
  buildImportPreview,
  type ColumnMapping,
  type ColumnRole,
  type MappedRow,
  type ValidationWarning,
} from '@/utils/csvParser';

// ─── Constants ────────────────────────────────────────────────────────────────

type Step = 'idle' | 'mapping' | 'preview' | 'importing' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function indicatorLabel(key: string): string {
  return INDICATOR_META.find((m) => m.key === key)?.label ?? key;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: 'success' | 'error';
}
function StatusBadge({ status }: StatusBadgeProps) {
  const color = status === 'success' ? 'var(--color-success)' : 'var(--color-danger)';
  const bg    = status === 'success' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)';
  const label = status === 'success' ? 'Succès' : 'Erreur';
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '4px',
      padding:       '2px 8px',
      borderRadius:  '10px',
      fontSize:      '11px',
      fontWeight:    600,
      color,
      backgroundColor: bg,
      fontFamily:    'var(--font-sans)',
    }}>
      {status === 'success'
        ? <CheckCircle2 size={11} />
        : <XCircle size={11} />
      }
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Import() {
  const [step,          setStep]          = useState<Step>('idle');
  const [dragActive,    setDragActive]    = useState(false);
  const [fileName,      setFileName]      = useState('');
  const [parseError,    setParseError]    = useState<string | null>(null);
  const [rawHeaders,    setRawHeaders]    = useState<string[]>([]);
  const [rawRows,       setRawRows]       = useState<Record<string, string>[]>([]);
  const [mappings,      setMappings]      = useState<ColumnMapping[]>([]);
  const [preview,       setPreview]       = useState<{ mappedRows: MappedRow[]; warnings: ValidationWarning[] } | null>(null);
  const [progress,      setProgress]      = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [history,       setHistory]       = useState<ImportRecord[]>([]);
  const [historyLoading,setHistoryLoading]= useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load history on mount ──
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const records = await getImportHistory();
      setHistory(records);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── File handling ──
  const processFile = useCallback(async (file: File) => {
    setParseError(null);
    setFileName(file.name);

    const result = await parseFile(file);
    if (result.error) {
      setParseError(result.error);
      return;
    }
    if (result.headers.length === 0) {
      setParseError('Le fichier semble vide ou ne contient pas de colonnes.');
      return;
    }

    setRawHeaders(result.headers);
    setRawRows(result.rows);
    const detected = autoDetectMappings(result.headers);
    setMappings(detected);
    setStep('mapping');
  }, []);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(true);
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }
  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  }

  // ── Mapping changes ──
  function updateRole(header: string, role: ColumnRole) {
    setMappings((prev) =>
      prev.map((m) =>
        m.header === header
          ? { ...m, role, indicatorKey: role === 'indicator' ? (m.indicatorKey ?? INDICATOR_META[0].key) : undefined }
          : m
      )
    );
  }

  function updateIndicatorKey(header: string, key: string) {
    setMappings((prev) =>
      prev.map((m) => (m.header === header ? { ...m, indicatorKey: key } : m))
    );
  }

  function goToPreview() {
    const p = buildImportPreview(rawRows, mappings);
    setPreview(p);
    setStep('preview');
  }

  // ── Import execution ──
  async function runImport() {
    if (!preview) return;
    const { mappedRows } = preview;
    setStep('importing');
    setProgress(0);
    setProgressTotal(mappedRows.length);

    let successCount = 0;
    let hasError = false;

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      try {
        await addKpiEntry({
          category:  row.category,
          indicator: row.indicator,
          value:     row.value,
          period:    row.period,
          source:    'import',
        });
        successCount++;
      } catch {
        hasError = true;
      }
      setProgress(i + 1);
    }

    try {
      await addImportRecord({
        filename:  fileName,
        row_count: successCount,
        status:    hasError ? 'error' : 'success',
      });
    } catch {
      // silently ignore if history write fails
    }

    setImportedCount(successCount);
    setStep('done');
    loadHistory();
  }

  // ── Reset ──
  function reset() {
    setStep('idle');
    setFileName('');
    setParseError(null);
    setRawHeaders([]);
    setRawRows([]);
    setMappings([]);
    setPreview(null);
    setProgress(0);
    setProgressTotal(0);
    setImportedCount(0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           '32px',
      maxWidth:      '960px',
    }}>

      {/* ── A. Page header ── */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize:   '24px',
          fontWeight: 700,
          color:      'var(--color-text-primary)',
          margin:     0,
          lineHeight: 1.2,
        }}>
          Import de données
        </h1>
        <p style={{
          fontSize:   '14px',
          color:      'var(--color-text-secondary)',
          margin:     '4px 0 0',
          fontFamily: 'var(--font-sans)',
        }}>
          Importez vos indicateurs depuis un fichier CSV ou Excel
        </p>
      </div>

      {/* ── Main import card ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius:    '12px',
        boxShadow:       '0 1px 3px rgba(0,0,0,0.06)',
        overflow:        'hidden',
      }}>

        {/* ── STEP: idle — drop zone ── */}
        {step === 'idle' && (
          <div style={{ padding: '32px' }}>
            {/* Parse error */}
            {parseError && (
              <div role="alert" style={{
                display:         'flex',
                alignItems:      'center',
                gap:             '10px',
                backgroundColor: 'rgba(220,38,38,0.05)',
                border:          '1px solid rgba(220,38,38,0.3)',
                borderRadius:    '8px',
                padding:         '10px 14px',
                marginBottom:    '20px',
                color:           'var(--color-danger)',
                fontSize:        '13px',
                fontFamily:      'var(--font-sans)',
              }}>
                <XCircle size={16} />
                {parseError}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="Zone de dépôt de fichier"
              style={{
                border:          `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius:    '12px',
                padding:         '56px 32px',
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             '16px',
                cursor:          'pointer',
                transition:      'all 0.15s ease',
                backgroundColor: dragActive ? 'rgba(30,64,175,0.04)' : 'transparent',
              }}
            >
              {/* Upload icon */}
              <div style={{
                width:           '56px',
                height:          '56px',
                borderRadius:    '14px',
                backgroundColor: dragActive ? 'rgba(30,64,175,0.12)' : 'rgba(30,64,175,0.06)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                transition:      'background-color 0.15s ease',
              }}>
                <Upload size={24} color={dragActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{
                  margin:      0,
                  fontSize:    '15px',
                  fontWeight:  600,
                  color:       dragActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
                  fontFamily:  'var(--font-sans)',
                  transition:  'color 0.15s ease',
                }}>
                  Glissez un fichier ici ou cliquez pour sélectionner
                </p>
                <p style={{
                  margin:     '6px 0 0',
                  fontSize:   '13px',
                  color:      'var(--color-text-secondary)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  Formats acceptés : .csv, .xlsx, .xls
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* ── STEP: mapping ── */}
        {step === 'mapping' && (
          <div>
            {/* Step header */}
            <StepHeader
              icon={<FileText size={16} />}
              step="1"
              title="Correspondance des colonnes"
              fileName={fileName}
            />

            <div style={{ padding: '0 28px 28px' }}>
              {/* Preview table */}
              <p style={{
                fontSize:   '13px',
                color:      'var(--color-text-secondary)',
                margin:     '0 0 16px',
                fontFamily: 'var(--font-sans)',
              }}>
                Aperçu des 5 premières lignes — assignez un rôle à chaque colonne
              </p>

              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{
                  width:          '100%',
                  borderCollapse: 'collapse',
                  fontSize:       '12px',
                  fontFamily:     'var(--font-sans)',
                }}>
                  <thead>
                    <tr>
                      {rawHeaders.map((h) => (
                        <th key={h} style={{
                          padding:     '0 12px 12px',
                          textAlign:   'left',
                          verticalAlign: 'bottom',
                        }}>
                          {/* Column header */}
                          <div style={{
                            fontSize:   '11px',
                            fontWeight: 600,
                            color:      'var(--color-text-secondary)',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {h}
                          </div>
                          {/* Role selector */}
                          <MappingSelect
                            mapping={mappings.find((m) => m.header === h)!}
                            onRoleChange={(role) => updateRole(h, role)}
                            onIndicatorChange={(key) => updateIndicatorKey(h, key)}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 5).map((row, i) => (
                      <tr key={i} style={{
                        backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      }}>
                        {rawHeaders.map((h) => (
                          <td key={h} style={{
                            padding:    '7px 12px',
                            color:      'var(--color-text-primary)',
                            fontSize:   '12px',
                            borderTop:  '1px solid var(--color-border)',
                            maxWidth:   '160px',
                            overflow:   'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {row[h] || <span style={{ color: 'var(--color-border)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                display:        'flex',
                justifyContent: 'flex-end',
                gap:            '10px',
              }}>
                <button onClick={reset} style={secondaryBtnStyle}>
                  Annuler
                </button>
                <button onClick={goToPreview} style={primaryBtnStyle}>
                  Continuer
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: preview ── */}
        {step === 'preview' && preview && (
          <div>
            <StepHeader
              icon={<FileCheck size={16} />}
              step="2"
              title="Aperçu avant import"
              fileName={fileName}
            />

            <div style={{ padding: '0 28px 28px' }}>
              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(217,119,6,0.05)',
                  border:          '1px solid rgba(217,119,6,0.25)',
                  borderRadius:    '8px',
                  padding:         '12px 16px',
                  marginBottom:    '20px',
                }}>
                  <div style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '8px',
                    marginBottom: '8px',
                    color:      'var(--color-warning)',
                    fontSize:   '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                  }}>
                    <AlertTriangle size={14} />
                    {preview.warnings.length} avertissement{preview.warnings.length > 1 ? 's' : ''}
                  </div>
                  <ul style={{
                    margin:     0,
                    padding:    '0 0 0 22px',
                    fontSize:   '12px',
                    color:      'var(--color-warning)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {preview.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                    {preview.warnings.length > 5 && (
                      <li>… et {preview.warnings.length - 5} autre(s)</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Row count summary */}
              <p style={{
                fontSize:   '13px',
                color:      'var(--color-text-secondary)',
                margin:     '0 0 16px',
                fontFamily: 'var(--font-sans)',
              }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {preview.mappedRows.length} ligne{preview.mappedRows.length !== 1 ? 's' : ''}
                </strong>{' '}
                seront importées
              </p>

              {/* Preview table */}
              {preview.mappedRows.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                  <table style={{
                    width:          '100%',
                    borderCollapse: 'collapse',
                    fontSize:       '12px',
                    fontFamily:     'var(--font-sans)',
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Période', 'Indicateur', 'Valeur'].map((h) => (
                          <th key={h} style={{
                            padding:       '8px 12px',
                            textAlign:     'left',
                            fontSize:      '11px',
                            fontWeight:    600,
                            color:         'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.mappedRows.slice(0, 20).map((row, i) => (
                        <tr key={i} style={{
                          backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                        }}>
                          <td style={previewCellStyle}>{row.period}</td>
                          <td style={previewCellStyle}>{indicatorLabel(row.indicator)}</td>
                          <td style={{ ...previewCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                      {preview.mappedRows.length > 20 && (
                        <tr>
                          <td colSpan={3} style={{
                            ...previewCellStyle,
                            color:     'var(--color-text-secondary)',
                            textAlign: 'center',
                            fontStyle: 'italic',
                          }}>
                            … et {preview.mappedRows.length - 20} ligne(s) supplémentaire(s)
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.mappedRows.length === 0 && (
                <div style={{
                  textAlign:   'center',
                  padding:     '32px',
                  color:       'var(--color-text-secondary)',
                  fontSize:    '13px',
                  fontFamily:  'var(--font-sans)',
                  border:      '1px dashed var(--color-border)',
                  borderRadius: '8px',
                  marginBottom: '24px',
                }}>
                  Aucune ligne valide à importer. Vérifiez la correspondance des colonnes.
                </div>
              )}

              <div style={{
                display:        'flex',
                justifyContent: 'flex-end',
                gap:            '10px',
              }}>
                <button onClick={() => setStep('mapping')} style={secondaryBtnStyle}>
                  Retour
                </button>
                <button
                  onClick={runImport}
                  disabled={preview.mappedRows.length === 0}
                  style={{
                    ...primaryBtnStyle,
                    opacity: preview.mappedRows.length === 0 ? 0.5 : 1,
                    cursor:  preview.mappedRows.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Importer {preview.mappedRows.length > 0 && `(${preview.mappedRows.length} lignes)`}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: importing ── */}
        {step === 'importing' && (
          <div style={{
            padding:       '48px 32px',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           '20px',
          }}>
            <div style={{
              width:           '52px',
              height:          '52px',
              borderRadius:    '50%',
              backgroundColor: 'rgba(30,64,175,0.08)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              <Loader2
                size={24}
                color="var(--color-primary)"
                style={{ animation: 'spin 1s linear infinite' }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                margin:     0,
                fontSize:   '15px',
                fontWeight: 600,
                color:      'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
              }}>
                Import en cours…
              </p>
              <p style={{
                margin:     '4px 0 0',
                fontSize:   '13px',
                color:      'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}>
                {progress} / {progressTotal} lignes traitées
              </p>
            </div>
            {/* Progress bar */}
            <div style={{
              width:           '280px',
              height:          '4px',
              backgroundColor: 'var(--color-border)',
              borderRadius:    '2px',
              overflow:        'hidden',
            }}>
              <div style={{
                height:          '100%',
                width:           `${progressTotal > 0 ? (progress / progressTotal) * 100 : 0}%`,
                backgroundColor: 'var(--color-primary)',
                borderRadius:    '2px',
                transition:      'width 0.1s ease',
              }} />
            </div>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && (
          <div style={{
            padding:       '48px 32px',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           '16px',
          }}>
            <div style={{
              width:           '52px',
              height:          '52px',
              borderRadius:    '50%',
              backgroundColor: 'rgba(5,150,105,0.1)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              <CheckCircle2 size={24} color="var(--color-success)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                margin:     0,
                fontSize:   '16px',
                fontWeight: 600,
                color:      'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
              }}>
                Import terminé
              </p>
              <p style={{
                margin:     '4px 0 0',
                fontSize:   '13px',
                color:      'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}>
                {importedCount} ligne{importedCount !== 1 ? 's' : ''} importée{importedCount !== 1 ? 's' : ''} avec succès
              </p>
            </div>
            <button onClick={reset} style={{ ...secondaryBtnStyle, marginTop: '8px' }}>
              <RotateCcw size={13} />
              Nouvel import
            </button>
          </div>
        )}

      </div>

      {/* ── F. Import history ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius:    '12px',
        boxShadow:       '0 1px 3px rgba(0,0,0,0.06)',
        overflow:        'hidden',
      }}>
        {/* Section header */}
        <div style={{
          padding:       '16px 20px',
          borderBottom:  '1px solid var(--color-border)',
          display:       'flex',
          alignItems:    'center',
          gap:           '10px',
        }}>
          <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize:   '14px',
            fontWeight: 600,
            color:      'var(--color-text-primary)',
            margin:     0,
          }}>
            Historique des imports
          </h2>
        </div>

        {historyLoading ? (
          <div style={{
            padding:    '24px 20px',
            color:      'var(--color-text-secondary)',
            fontSize:   '13px',
            fontFamily: 'var(--font-sans)',
          }}>
            Chargement…
          </div>
        ) : history.length === 0 ? (
          <div style={{
            padding:    '32px 20px',
            textAlign:  'center',
            color:      'var(--color-text-secondary)',
            fontSize:   '13px',
            fontFamily: 'var(--font-sans)',
          }}>
            Aucun import effectué pour le moment
          </div>
        ) : (
          <table style={{
            width:          '100%',
            borderCollapse: 'collapse',
            fontSize:       '13px',
            fontFamily:     'var(--font-sans)',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Fichier', 'Date', 'Lignes importées', 'Statut'].map((h) => (
                  <th key={h} style={{
                    padding:       '10px 20px',
                    textAlign:     'left',
                    fontSize:      '11px',
                    fontWeight:    600,
                    color:         'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((record, i) => (
                <tr key={record.id} style={{
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                  borderBottom:    i < history.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                      <span style={{
                        maxWidth:     '240px',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                        display:      'block',
                      }}>
                        {record.filename}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(record.imported_at)}
                  </td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {record.row_count}
                  </td>
                  <td style={{ padding: '10px 20px' }}>
                    <StatusBadge status={record.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Spinner keyframe (injected once) */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display:         'inline-flex',
  alignItems:      'center',
  gap:             '6px',
  padding:         '8px 18px',
  backgroundColor: 'var(--color-primary)',
  color:           '#fff',
  border:          'none',
  borderRadius:    '7px',
  fontSize:        '13px',
  fontWeight:      600,
  fontFamily:      'var(--font-sans)',
  cursor:          'pointer',
  lineHeight:      1,
};

const secondaryBtnStyle: React.CSSProperties = {
  display:         'inline-flex',
  alignItems:      'center',
  gap:             '6px',
  padding:         '8px 16px',
  backgroundColor: 'transparent',
  color:           'var(--color-text-secondary)',
  border:          '1px solid var(--color-border)',
  borderRadius:    '7px',
  fontSize:        '13px',
  fontWeight:      500,
  fontFamily:      'var(--font-sans)',
  cursor:          'pointer',
  lineHeight:      1,
};

const previewCellStyle: React.CSSProperties = {
  padding:      '7px 12px',
  color:        'var(--color-text-primary)',
  fontSize:     '12px',
  borderTop:    '1px solid var(--color-border)',
  maxWidth:     '200px',
  overflow:     'hidden',
  textOverflow: 'ellipsis',
  whiteSpace:   'nowrap',
};

// ─── StepHeader sub-component ─────────────────────────────────────────────────

interface StepHeaderProps {
  icon:     React.ReactNode;
  step:     string;
  title:    string;
  fileName: string;
}

function StepHeader({ icon, step, title, fileName }: StepHeaderProps) {
  return (
    <div style={{
      padding:      '16px 28px',
      borderBottom: '1px solid var(--color-border)',
      display:      'flex',
      alignItems:   'center',
      gap:          '12px',
    }}>
      <div style={{
        width:           '30px',
        height:          '30px',
        borderRadius:    '50%',
        backgroundColor: 'rgba(30,64,175,0.08)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           'var(--color-primary)',
        flexShrink:      0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{
          margin:     0,
          fontSize:   '13px',
          fontWeight: 600,
          color:      'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
        }}>
          Étape {step} — {title}
        </p>
        <p style={{
          margin:     '1px 0 0',
          fontSize:   '12px',
          color:      'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
        }}>
          {fileName}
        </p>
      </div>
    </div>
  );
}

// ─── MappingSelect sub-component ──────────────────────────────────────────────

interface MappingSelectProps {
  mapping:           ColumnMapping;
  onRoleChange:      (role: ColumnRole) => void;
  onIndicatorChange: (key: string)     => void;
}

function MappingSelect({ mapping, onRoleChange, onIndicatorChange }: MappingSelectProps) {
  const selectStyle: React.CSSProperties = {
    padding:         '4px 8px',
    fontSize:        '11px',
    fontFamily:      'var(--font-sans)',
    border:          '1px solid var(--color-border)',
    borderRadius:    '5px',
    backgroundColor: 'var(--color-bg)',
    color:           'var(--color-text-primary)',
    cursor:          'pointer',
    width:           '100%',
    maxWidth:        '180px',
    outline:         'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <select
        value={mapping.role}
        onChange={(e) => onRoleChange(e.target.value as ColumnRole)}
        style={{
          ...selectStyle,
          borderColor:
            mapping.role === 'period'    ? 'rgba(30,64,175,0.4)' :
            mapping.role === 'value'     ? 'rgba(5,150,105,0.4)' :
            mapping.role === 'indicator' ? 'rgba(217,119,6,0.4)' :
            'var(--color-border)',
        }}
        aria-label={`Rôle de la colonne ${mapping.header}`}
      >
        <option value="ignore">Ignorer</option>
        <option value="period">Période</option>
        <option value="value">Valeur</option>
        <option value="indicator">Indicateur</option>
      </select>

      {mapping.role === 'indicator' && (
        <select
          value={mapping.indicatorKey ?? INDICATOR_META[0].key}
          onChange={(e) => onIndicatorChange(e.target.value)}
          style={selectStyle}
          aria-label={`Indicateur KPI pour la colonne ${mapping.header}`}
        >
          {INDICATOR_META.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
