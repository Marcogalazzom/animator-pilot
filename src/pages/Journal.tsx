import { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Plus, Trash2, X, Pencil, Search, Tag, Pin, Users as UsersIcon, Eye, EyeOff } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
} from '@/db/journal';
import { getResidents } from '@/db/residents';
import type { JournalEntry, JournalMood, Resident } from '@/db/types';

const MOODS: Record<JournalMood, { label: string; emoji: string; chip: string }> = {
  great:     { label: 'Super',     emoji: '\u2600\uFE0F', chip: 'done' },
  good:      { label: 'Bien',      emoji: '\uD83D\uDE0A', chip: 'info' },
  neutral:   { label: 'Neutre',    emoji: '\uD83D\uDE10', chip: 'ghost' },
  difficult: { label: 'Difficile', emoji: '\uD83D\uDE15', chip: 'warn' },
  bad:       { label: 'Mauvais',   emoji: '\uD83D\uDE1E', chip: 'danger' },
};

const MOOD_KEYS = Object.keys(MOODS) as JournalMood[];

type JournalTab = 'feed' | 'by-resident';

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function parseLinkedIds(csv: string): number[] {
  if (!csv) return [];
  return csv.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}

function joinLinkedIds(ids: number[]): string {
  return ids.join(',');
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<JournalTab>('feed');
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mood, setMood] = useState<JournalMood>('good');
  const [isShared, setIsShared] = useState(false);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  const addToast = useToastStore((s) => s.add);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    Promise.all([
      getJournalEntries().catch((err) => {
        console.error('[journal] load failed:', err);
        addToast('Impossible de charger le carnet de bord', 'error');
        return [] as JournalEntry[];
      }),
      getResidents().catch(() => [] as Resident[]),
    ]).then(([j, r]) => {
      setEntries(j);
      setResidents(r);
      if (r[0]) setSelectedResidentId(r[0].id);
    }).finally(() => setLoading(false));
  }, [addToast]);

  const residentMap = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);

  const filtered = useMemo(() => {
    let list = entries;
    if (tab === 'by-resident' && selectedResidentId) {
      list = list.filter((e) => parseLinkedIds(e.linked_resident_ids).includes(selectedResidentId));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.content.toLowerCase().includes(q) || e.tags.toLowerCase().includes(q));
    }
    return list;
  }, [entries, search, tab, selectedResidentId]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      date: fd.get('date') as string,
      content: fd.get('content') as string,
      mood,
      tags: fd.get('tags') as string,
      is_shared: isShared ? 1 : 0,
      linked_resident_ids: joinLinkedIds(linkedIds),
    };

    try {
      if (editId) {
        await updateJournalEntry(editId, data);
        setEntries((prev) => prev.map((e) => e.id === editId ? { ...e, ...data } : e));
        addToast('Entrée mise à jour', 'success');
      } else {
        const id = await createJournalEntry(data);
        setEntries((prev) => [
          { ...data, id, created_at: new Date().toISOString() },
          ...prev,
        ]);
        addToast('Entrée ajoutée', 'success');
      }
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      console.error('[journal] save failed:', err);
      addToast('Erreur lors de l\'enregistrement', 'error');
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteJournalEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      addToast('Entrée supprimée', 'success');
    } catch (err) {
      console.error('[journal] delete failed:', err);
      addToast('Erreur lors de la suppression', 'error');
    }
  }

  async function toggleShare(entry: JournalEntry) {
    const next = entry.is_shared ? 0 : 1;
    try {
      await updateJournalEntry(entry.id, { is_shared: next });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, is_shared: next } : e));
    } catch (err) {
      console.error('[journal] toggle share failed:', err);
      addToast('Erreur', 'error');
    }
  }

  const editItem = editId ? entries.find((e) => e.id === editId) : null;

  useEffect(() => {
    if (showForm) {
      setMood(editItem?.mood ?? 'good');
      setIsShared((editItem?.is_shared ?? 0) === 1);
      setLinkedIds(editItem ? parseLinkedIds(editItem.linked_resident_ids) : []);
    }
  }, [showForm, editItem]);

  useEffect(() => {
    if (editId && !editItem) {
      setEditId(null);
      setShowForm(false);
    }
  }, [editId, editItem]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 20,
      maxWidth: 1100, animation: 'slide-in 0.22s ease-out',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pin size={11} /> Notes quotidiennes — partagez avec l'équipe ou gardez privé
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => { setEditId(null); setShowForm(true); }}>
          <Plus size={13} strokeWidth={2.5} /> Nouvelle entrée
        </button>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', borderRadius: 999,
          border: '1px solid var(--line)', overflow: 'hidden',
          background: 'var(--surface)',
        }}>
          {([
            { id: 'feed', label: 'Fil du jour' },
            { id: 'by-resident', label: 'Par résident' },
          ] as Array<{ id: JournalTab; label: string }>).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '7px 16px', border: 'none',
                  background: active ? 'var(--terra-soft)' : 'transparent',
                  color: active ? 'var(--terra-deep)' : 'var(--ink-2)',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{
          flex: '1 1 240px', maxWidth: 400,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 999, padding: '6px 14px',
        }}>
          <Search size={14} style={{ color: 'var(--ink-3)' }} />
          <input
            type="text"
            placeholder="Rechercher dans le carnet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 13, color: 'var(--ink)',
            }}
          />
        </div>
      </div>

      {/* Body — Feed or By-resident */}
      {tab === 'feed' ? (
        <FeedList
          entries={filtered}
          loading={loading}
          search={search}
          residentMap={residentMap}
          onEdit={(id) => { setEditId(id); setShowForm(true); }}
          onDelete={handleDelete}
          onToggleShare={toggleShare}
          onCreate={() => { setEditId(null); setShowForm(true); }}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 280px) 1fr',
          gap: 20,
        }}>
          {/* Resident list */}
          <div className="card" style={{
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', maxHeight: 'calc(100vh - 260px)',
          }}>
            {residents.length === 0 ? (
              <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
                Aucun résident.
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto' }}>
                {residents.map((r) => {
                  const active = r.id === selectedResidentId;
                  const count = entries.filter((e) => parseLinkedIds(e.linked_resident_ids).includes(r.id)).length;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedResidentId(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px', textAlign: 'left',
                        background: active ? 'var(--terra-soft)' : 'transparent',
                        borderBottom: '1px solid var(--line)',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: active ? 'var(--terra)' : 'var(--surface-2)',
                        color: active ? '#fff' : 'var(--ink-2)',
                        display: 'grid', placeItems: 'center',
                        fontWeight: 600, fontSize: 12,
                        border: active ? 'none' : '1px solid var(--line)',
                      }}>
                        {initials(r.display_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600, fontSize: 13.5,
                          color: active ? 'var(--terra-deep)' : 'var(--ink)',
                        }}>
                          {r.display_name}
                        </div>
                      </div>
                      <span className={count > 0 ? 'chip memory' : 'chip ghost'}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filtered feed */}
          <FeedList
            entries={filtered}
            loading={loading}
            search={search}
            residentMap={residentMap}
            onEdit={(id) => { setEditId(id); setShowForm(true); }}
            onDelete={handleDelete}
            onToggleShare={toggleShare}
            onCreate={() => {
              setEditId(null);
              if (selectedResidentId) setLinkedIds([selectedResidentId]);
              setShowForm(true);
            }}
            emptyHint={selectedResidentId
              ? "Aucune note pour ce résident — taggez-le dans une nouvelle entrée."
              : "Sélectionnez un résident."}
          />
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(35, 29, 24, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => { setShowForm(false); setEditId(null); }}
        >
          <div
            className="card"
            style={{ padding: 24, width: 580, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
              <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>
                {editId ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
              </h2>
              <div style={{ flex: 1 }} />
              <button
                className="btn ghost"
                onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ padding: 6 }}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={editItem?.date ?? new Date().toISOString().slice(0, 10)}
                    required
                    style={inputStyle}
                  />
                </Field>
                <Field label="Humeur">
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    {MOOD_KEYS.map((k) => {
                      const checked = mood === k;
                      return (
                        <label key={k} style={{ cursor: 'pointer', textAlign: 'center' }}>
                          <input
                            type="radio"
                            name="mood-radio"
                            value={k}
                            checked={checked}
                            onChange={() => setMood(k)}
                            style={{ display: 'none' }}
                          />
                          <span
                            style={{
                              fontSize: 22, display: 'block',
                              opacity: checked ? 1 : 0.45,
                              transform: checked ? 'scale(1.15)' : 'scale(1)',
                              filter: checked ? 'none' : 'grayscale(0.4)',
                              transition: 'opacity 0.15s, transform 0.15s, filter 0.15s',
                            }}
                            title={MOODS[k].label}
                          >
                            {MOODS[k].emoji}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <Field label="Notes de la journée">
                <textarea
                  name="content" rows={6}
                  defaultValue={editItem?.content ?? ''}
                  required
                  placeholder="Ce qui s'est passé, ce qui a marché, idées pour demain…"
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </Field>

              <Field label="Tags (séparés par des virgules)">
                <input
                  name="tags"
                  defaultValue={editItem?.tags ?? ''}
                  placeholder="peinture, réunion, idée…"
                  style={inputStyle}
                />
              </Field>

              <Field label="Résidents concernés">
                {residents.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                    Ajoutez d'abord des résidents pour pouvoir les tagger.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {residents.map((r) => {
                      const checked = linkedIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setLinkedIds((prev) =>
                            prev.includes(r.id)
                              ? prev.filter((id) => id !== r.id)
                              : [...prev, r.id]
                          )}
                          className={checked ? 'chip memory' : 'chip ghost'}
                          style={{ border: 'none', cursor: 'pointer' }}
                        >
                          {r.display_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Field>

              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: isShared ? 'var(--sage-soft)' : 'var(--surface-2)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                />
                {isShared ? <Eye size={14} style={{ color: 'var(--sage-deep)' }} /> : <EyeOff size={14} style={{ color: 'var(--ink-3)' }} />}
                <span style={{ fontSize: 13, fontWeight: 500, color: isShared ? 'var(--sage-deep)' : 'var(--ink-2)' }}>
                  {isShared ? 'Partagé avec l\'équipe' : 'Privé (visible par vous seul)'}
                </span>
              </label>

              <button type="submit" className="btn primary" style={{ justifyContent: 'center' }}>
                {editId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface FeedListProps {
  entries: JournalEntry[];
  loading: boolean;
  search: string;
  residentMap: Map<number, Resident>;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleShare: (entry: JournalEntry) => void;
  onCreate: () => void;
  emptyHint?: string;
}

function FeedList({
  entries, loading, search, residentMap,
  onEdit, onDelete, onToggleShare, onCreate, emptyHint,
}: FeedListProps) {
  if (loading) {
    return <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</p>;
  }
  if (entries.length === 0) {
    return (
      <div className="card" style={{
        padding: 48, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <BookOpen size={36} style={{ color: 'var(--ink-4)' }} />
        <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>
          {search ? 'Aucun résultat' : 'Aucune entrée pour le moment'}
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, maxWidth: 360 }}>
          {emptyHint ?? (search ? 'Essayez un autre mot-clé.' : 'Commencez votre carnet — quelques lignes par jour suffisent.')}
        </p>
        {!search && (
          <button className="btn primary" onClick={onCreate} style={{ marginTop: 6 }}>
            <Plus size={13} strokeWidth={2.5} /> Ajouter une entrée
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entries.map((entry) => {
        const m = MOODS[entry.mood];
        const isPrivate = entry.is_shared !== 1;
        const linkedResidents = parseLinkedIds(entry.linked_resident_ids)
          .map((id) => residentMap.get(id))
          .filter((r): r is Resident => !!r);
        return (
          <div key={entry.id} className="card" style={{ padding: '16px 20px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{m.emoji}</span>
                <div>
                  <p style={{
                    margin: 0, fontSize: 13.5, fontWeight: 600,
                    color: 'var(--ink)', textTransform: 'capitalize',
                  }}>
                    {formatDate(entry.date)}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className={`chip ${m.chip}`}>{m.label}</span>
                    <button
                      onClick={() => onToggleShare(entry)}
                      className={isPrivate ? 'chip ghost' : 'chip done'}
                      style={{ border: 'none', cursor: 'pointer' }}
                      title={isPrivate ? 'Cliquer pour partager' : 'Cliquer pour rendre privé'}
                    >
                      {isPrivate ? <Pin size={10} fill="currentColor" /> : <Eye size={10} />}
                      {isPrivate ? 'Privé' : 'Partagé'}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => onEdit(entry.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-3)', padding: 4, display: 'flex',
                  }}
                  title="Modifier"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--danger)', padding: 4, display: 'flex',
                  }}
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <p style={{
              margin: '0 0 8px', fontSize: 13.5, color: 'var(--ink)',
              lineHeight: 1.65, whiteSpace: 'pre-wrap',
            }}>
              {entry.content}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {linkedResidents.length > 0 && (
                <span className="chip creative" style={{ alignItems: 'center' }}>
                  <UsersIcon size={9} />
                  {linkedResidents.map((r) => r.display_name.split(/\s+/)[0]).join(', ')}
                </span>
              )}
              {entry.tags.split(',').filter(Boolean).map((tag, i) => (
                <span key={i} className="chip memory">
                  <Tag size={9} /> {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--line)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)',
  color: 'var(--ink)', outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
