import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  Clock, Loader2,
} from 'lucide-react';
import { getImportHistory } from '@/db';
import type { ImportRecord } from '@/db/types';

// ─── Helpers ──────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Mock data ───────────────────────────────────────────────

const MOCK_HISTORY: ImportRecord[] = [
  { id: 1, filename: 'residents_avril.csv', imported_at: '2026-04-01T09:30:00', row_count: 42, status: 'success' },
  { id: 2, filename: 'inventaire_mars.csv', imported_at: '2026-03-15T14:00:00', row_count: 28, status: 'success' },
  { id: 3, filename: 'planning_activites.xlsx', imported_at: '2026-03-01T10:15:00', row_count: 15, status: 'success' },
];

// ─── Component ───────────────────────────────────────────────

export default function Import() {
  const [history, setHistory] = useState<ImportRecord[]>(MOCK_HISTORY);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getImportHistory()
      .then((rows) => { if (rows.length > 0) setHistory(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // TODO: handle file import
  }

  function handleFileChange(_e: ChangeEvent<HTMLInputElement>) {
    // TODO: handle file import
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700,
          color: 'var(--color-text-primary)', margin: 0,
        }}>
          Import de données
        </h1>
        <p style={{
          fontSize: '14px', color: 'var(--color-text-secondary)',
          margin: '4px 0 0', fontFamily: 'var(--font-sans)',
        }}>
          Importez des fichiers CSV ou Excel pour enrichir vos données
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          backgroundColor: dragActive ? 'rgba(30,64,175,0.05)' : 'var(--color-surface)',
          border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: '12px', padding: '48px 24px', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
      >
        <Upload size={36} style={{ color: dragActive ? 'var(--color-primary)' : 'var(--color-border)', marginBottom: '12px' }} />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
          Glissez un fichier ici ou cliquez pour sélectionner
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
          CSV, XLSX — Résidents, inventaire, activités
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Import types info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Résidents', desc: 'Prénom, chambre, intérêts, participation', color: '#DC2626' },
          { label: 'Inventaire', desc: 'Article, catégorie, quantité, état', color: '#D97706' },
          { label: 'Activités', desc: 'Titre, type, date, lieu, participants', color: '#7C3AED' },
          { label: 'Personnel', desc: 'Nom, rôle, téléphone, email', color: '#059669' },
        ].map(({ label, desc, color }) => (
          <div key={label} style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px',
            borderLeft: `3px solid ${color}`,
          }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
              {label}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Import history */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            Historique des imports
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement...
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '24px 20px', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Aucun import effectué
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {history.map((rec, i) => (
              <li key={rec.id} style={{
                padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px',
                borderBottom: i < history.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                {rec.status === 'success' ? (
                  <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                ) : (
                  <AlertTriangle size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    <FileText size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    {rec.filename}
                  </p>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  {rec.row_count} lignes
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  {formatDateTime(rec.imported_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
