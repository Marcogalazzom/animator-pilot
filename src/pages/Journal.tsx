import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, X, Trash2, Filter, Users as UsersIcon, Pin, Image, Sparkles,
  Laugh, Smile, Meh, Frown, Angry,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
} from '@/db/journal';
import { getResidents } from '@/db/residents';
import { getSetting } from '@/db/settings';
import { uploadJournalPhoto } from '@/services/firebase';
import { tagChipClass } from '@/utils/tagColor';
import type {
  JournalEntry, JournalMood, JournalCategory, Resident,
} from '@/db/types';

/* ─── Constants ─────────────────────────────────────────────── */

// Icônes lucide — 5 niveaux visuellement distincts, palette cohérente avec les chips.
const MOODS: Record<JournalMood, { label: string; Icon: typeof Smile; color: string }> = {
  great:     { label: 'Super',     Icon: Laugh, color: 'var(--sage-deep)' },
  good:      { label: 'Bien',      Icon: Smile, color: 'var(--cat-body)' },
  neutral:   { label: 'Neutre',    Icon: Meh,   color: 'var(--ink-3)' },
  difficult: { label: 'Difficile', Icon: Frown, color: 'var(--warn)' },
  bad:       { label: 'Mauvais',   Icon: Angry, color: 'var(--danger)' },
};
const MOOD_KEYS = Object.keys(MOODS) as JournalMood[];

const CATEGORIES: Record<JournalCategory, string> = {
  memory:   'Mémoire',
  creative: 'Créatif',
  body:     'Corps',
  outing:   'Sortie',
  rdv:      'Admin',
  prep:     'Prépa',
};
const CATEGORY_KEYS = Object.keys(CATEGORIES) as JournalCategory[];

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
                       'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

type JournalTab = 'feed' | 'by-resident';

/* ─── Helpers ────────────────────────────────────────────────── */

function parseLinkedIds(csv: string): number[] {
  if (!csv) return [];
  return csv.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}
function joinLinkedIds(ids: number[]): string { return ids.join(','); }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  const weekday = WEEKDAYS[d.getDay()];
  const month = MONTHS_SHORT[d.getMonth()];

  if (diffDays === 0) return `Aujourd'hui · ${weekday} ${d.getDate()} ${month}`;
  if (diffDays === 1) return `Hier · ${weekday} ${d.getDate()} ${month}`;
  if (d.getFullYear() !== new Date().getFullYear()) {
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${cap(weekday)} ${d.getDate()} ${month}`;
}

function timelineDateLabel(dateStr: string, time: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const label = `${d.getDate().toString().padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]}`;
  return time ? `${label} · ${time}` : label;
}

function sortEntries(list: JournalEntry[]): JournalEntry[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.time || '').localeCompare(a.time || '');
  });
}

function groupByDay(entries: JournalEntry[]): Array<{ key: string; label: string; entries: JournalEntry[] }> {
  const out = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const arr = out.get(e.date) ?? [];
    arr.push(e);
    out.set(e.date, arr);
  }
  return [...out.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, list]) => ({
      key: date,
      label: dayGroupLabel(date),
      entries: list.sort((a, b) => (b.time || '').localeCompare(a.time || '')),
    }));
}

/* ─── Main component ─────────────────────────────────────────── */

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<JournalTab>('feed');
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState<JournalCategory | ''>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mood, setMood] = useState<JournalMood>('good');
  const [category, setCategory] = useState<JournalCategory>('prep');
  const [isShared, setIsShared] = useState(true);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const addToast = useToastStore((s) => s.add);
  const formRef = useRef<HTMLFormElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    Promise.all([
      getJournalEntries().catch((err) => {
        console.error('[journal] load failed:', err);
        addToast('Impossible de charger le journal', 'error');
        return [] as JournalEntry[];
      }),
      getResidents().catch(() => [] as Resident[]),
      getSetting('user_first_name').catch(() => null),
    ]).then(([j, r, firstName]) => {
      setEntries(sortEntries(j));
      setResidents(r);
      if (r[0]) setSelectedResidentId(r[0].id);
      if (firstName) setCurrentUser(firstName);
    }).finally(() => setLoading(false));
  }, [addToast]);

  // Deep-link: /journal?note={id} ouvre directement le modal d'édition.
  useEffect(() => {
    const noteIdRaw = searchParams.get('note');
    if (!noteIdRaw || entries.length === 0) return;
    const noteId = Number(noteIdRaw);
    if (!Number.isFinite(noteId)) return;
    if (entries.some((e) => e.id === noteId)) {
      setEditId(noteId);
      setShowForm(true);
    }
    // Clean the URL once consumed so back-navigation doesn't re-open.
    searchParams.delete('note');
    setSearchParams(searchParams, { replace: true });
  }, [entries, searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filterCat) list = list.filter((e) => e.category === filterCat);
    if (tab === 'by-resident' && selectedResidentId) {
      list = list.filter((e) => parseLinkedIds(e.linked_resident_ids).includes(selectedResidentId));
    }
    return list;
  }, [entries, tab, selectedResidentId, filterCat]);

  const weekStats = useMemo(() => {
    const cutoff = startOfDay(new Date()); cutoff.setDate(cutoff.getDate() - 6);
    const recent = entries.filter((e) => new Date(e.date) >= cutoff);
    const shared = recent.filter((e) => e.is_shared === 1).length;
    const mentioned = new Set<number>();
    for (const e of recent) parseLinkedIds(e.linked_resident_ids).forEach((id) => mentioned.add(id));
    return { count: recent.length, shared, mentioned: mentioned.size };
  }, [entries]);

  const editItem = editId ? entries.find((e) => e.id === editId) : null;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      date: fd.get('date') as string,
      time: (fd.get('time') as string) ?? '',
      title: (fd.get('title') as string).trim(),
      author: editItem?.author || currentUser,
      content: fd.get('content') as string,
      mood,
      category,
      tags: fd.get('tags') as string,
      is_shared: isShared ? 1 : 0,
      linked_resident_ids: joinLinkedIds(linkedIds),
    };

    try {
      if (editId) {
        await updateJournalEntry(editId, data);
        setEntries((prev) => sortEntries(prev.map((e) => (e.id === editId ? { ...e, ...data } : e))));
        addToast('Note mise à jour', 'success');
      } else {
        const id = await createJournalEntry(data);
        setEntries((prev) => sortEntries([{ ...data, id, created_at: new Date().toISOString() }, ...prev]));
        addToast('Note ajoutée', 'success');
      }
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      console.error('[journal] save failed:', err);
      addToast("Erreur lors de l'enregistrement", 'error');
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteJournalEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      addToast('Note supprimée', 'success');
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
    } catch {
      addToast('Erreur', 'error');
    }
  }

  // Quick publish from sidebar composer
  async function handleQuickPublish(
    content: string,
    share: boolean,
    extras: {
      category: JournalCategory;
      linkedIds: number[];
      photoFile: File | null;
    },
  ) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = new Date();
    const dateISO = now.toISOString().slice(0, 10);

    // First line = title, rest = body. If there's only one line, use it as both
    // (title repeats in the card header but there's no body to orphan).
    const lines = trimmed.split('\n');
    const title = lines[0].slice(0, 60);
    let bodyContent = lines.slice(1).join('\n').trim();

    if (extras.photoFile) {
      try {
        const url = await uploadJournalPhoto(extras.photoFile, dateISO);
        bodyContent = bodyContent ? `${bodyContent}\n\n📷 ${url}` : `📷 ${url}`;
      } catch {
        addToast("La photo n'a pas pu être envoyée", 'error');
      }
    }

    const data = {
      date: dateISO,
      time: now.toTimeString().slice(0, 5),
      title,
      author: currentUser,
      content: bodyContent,
      mood: 'good' as JournalMood,
      category: extras.category,
      tags: '',
      is_shared: share ? 1 : 0,
      linked_resident_ids: joinLinkedIds(extras.linkedIds),
    };
    try {
      const id = await createJournalEntry(data);
      setEntries((prev) => sortEntries([{ ...data, id, created_at: now.toISOString() }, ...prev]));
      addToast('Note publiée', 'success');
    } catch {
      addToast("Erreur lors de l'enregistrement", 'error');
    }
  }

  // Edit mode: re-hydrate form state from the entry. For new notes, state is
  // seeded by openNewForm so we don't overwrite the by-resident pre-tag here.
  useEffect(() => {
    if (showForm && editItem) {
      setMood(editItem.mood);
      setCategory(editItem.category ?? 'prep');
      setIsShared((editItem.is_shared ?? 1) === 1);
      setLinkedIds(parseLinkedIds(editItem.linked_resident_ids));
    }
  }, [showForm, editItem]);

  useEffect(() => {
    if (editId && !editItem) { setEditId(null); setShowForm(false); }
  }, [editId, editItem]);

  function openNewForm() {
    setEditId(null);
    setMood('good');
    setCategory('prep');
    setIsShared(true);
    setLinkedIds(tab === 'by-resident' && selectedResidentId ? [selectedResidentId] : []);
    setShowForm(true);
  }

  const tabs: Array<[JournalTab, string]> = [
    ['feed', 'Fil du jour'],
    ['by-resident', 'Notes par résident'],
  ];

  return (
    <div style={{ maxWidth: 1320, display: 'flex', flexDirection: 'column', gap: 20, animation: 'slide-in 0.22s ease-out' }}>
      {/* Top bar: pill tabs + Filtrer + Nouvelle note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 10 }}>
          {tabs.map(([k, l]) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Filtrer */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn sm"
            onClick={() => setFilterOpen((v) => !v)}
            style={{ color: filterCat ? 'var(--terra-deep)' : undefined, borderColor: filterCat ? 'var(--terra)' : undefined }}
          >
            <Filter size={12} />
            {filterCat ? CATEGORIES[filterCat] : 'Filtrer'}
          </button>
          {filterOpen && (
            <div
              className="card"
              style={{
                position: 'absolute', right: 0, top: 36, zIndex: 20,
                padding: 8, display: 'flex', flexDirection: 'column', gap: 2,
                minWidth: 180, boxShadow: 'var(--shadow-md)',
              }}
              onMouseLeave={() => setFilterOpen(false)}
            >
              <div className="eyebrow" style={{ padding: '4px 10px' }}>Catégorie</div>
              <button onClick={() => { setFilterCat(''); setFilterOpen(false); }} style={filterItemStyle(!filterCat)}>
                Toutes catégories
              </button>
              {CATEGORY_KEYS.map((k) => (
                <button key={k} onClick={() => { setFilterCat(k); setFilterOpen(false); }} style={filterItemStyle(filterCat === k)}>
                  <span className={`chip ${k}`} style={{ fontSize: 10.5, padding: '2px 8px' }}>{CATEGORIES[k]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn primary" onClick={openNewForm}>
          <Plus size={13} strokeWidth={2.5} /> Nouvelle note
        </button>
      </div>

      {/* Body */}
      {tab === 'feed' ? (
        <FeedView
          days={groupByDay(filtered)}
          loading={loading}
          hasEntries={filtered.length > 0}
          currentUser={currentUser}
          residents={residents}
          weekStats={weekStats}
          onEdit={(id) => { setEditId(id); setShowForm(true); }}
          onToggleShare={toggleShare}
          onCreate={openNewForm}
          onQuickPublish={handleQuickPublish}
        />
      ) : (
        <ByResidentView
          residents={residents}
          selectedResidentId={selectedResidentId}
          onSelectResident={setSelectedResidentId}
          filtered={filtered}
          loading={loading}
          onEdit={(id) => { setEditId(id); setShowForm(true); }}
          onCreate={openNewForm}
        />
      )}

      {/* Modal form */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(35, 29, 24, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
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
                {editId ? 'Modifier la note' : 'Nouvelle note'}
              </h2>
              <div style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: 6 }} aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Titre">
                <input
                  name="title"
                  defaultValue={editItem?.title ?? ''}
                  required
                  placeholder="Atelier mémoire — belle séance"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 12 }}>
                <Field label="Date">
                  <input name="date" type="date" defaultValue={editItem?.date ?? new Date().toISOString().slice(0, 10)} required style={inputStyle} />
                </Field>
                <Field label="Heure">
                  <input name="time" type="time" defaultValue={editItem?.time ?? new Date().toTimeString().slice(0, 5)} style={inputStyle} />
                </Field>
                <Field label="Catégorie">
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {CATEGORY_KEYS.map((k) => {
                      const active = category === k;
                      return (
                        <button
                          key={k} type="button"
                          className={active ? `chip ${k}` : 'chip ghost'}
                          onClick={() => setCategory(k)}
                          style={{ cursor: 'pointer', border: 'none', fontSize: 11 }}
                        >
                          {CATEGORIES[k]}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <Field label="Contenu">
                <textarea
                  name="content" rows={5}
                  defaultValue={editItem?.content ?? ''}
                  required
                  placeholder="Ce qui s'est passé, ce qui a marché, à surveiller…"
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </Field>

              <Field label="Humeur">
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  {MOOD_KEYS.map((k) => {
                    const checked = mood === k;
                    const { Icon, color, label } = MOODS[k];
                    return (
                      <button
                        key={k} type="button"
                        onClick={() => setMood(k)}
                        title={label}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 10px', borderRadius: 999,
                          border: `1.5px solid ${checked ? color : 'var(--line)'}`,
                          background: checked ? `${color}1a` : 'var(--surface)',
                          color: checked ? color : 'var(--ink-3)',
                          fontSize: 12, fontWeight: checked ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <Icon size={16} strokeWidth={checked ? 2.2 : 1.6} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Tags (séparés par des virgules)">
                <input name="tags" defaultValue={editItem?.tags ?? ''} placeholder="atelier, idée…" style={inputStyle} />
              </Field>

              <Field label="Résidents concernés">
                {residents.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                    Ajoutez d'abord des résidents.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {residents.map((r) => {
                      const checked = linkedIds.includes(r.id);
                      return (
                        <button
                          key={r.id} type="button"
                          onClick={() => setLinkedIds((prev) =>
                            prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                          )}
                          className={checked ? `chip ${category}` : 'chip ghost'}
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
                <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
                {isShared
                  ? <UsersIcon size={14} style={{ color: 'var(--sage-deep)' }} />
                  : <Pin size={14} style={{ color: 'var(--ink-3)' }} />}
                <span style={{ fontSize: 13, fontWeight: 500, color: isShared ? 'var(--sage-deep)' : 'var(--ink-2)' }}>
                  {isShared ? "Partagée avec l'équipe" : 'Note privée'}
                </span>
              </label>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                {editId && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      if (confirm('Supprimer cette note ?')) {
                        handleDelete(editId);
                        setShowForm(false);
                        setEditId(null);
                      }
                    }}
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} /> Supprimer
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="submit" className="btn primary" style={{ justifyContent: 'center' }}>
                  {editId ? 'Mettre à jour' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Feed view ──────────────────────────────────────────────── */

interface FeedProps {
  days: Array<{ key: string; label: string; entries: JournalEntry[] }>;
  loading: boolean;
  hasEntries: boolean;
  currentUser: string;
  residents: Resident[];
  weekStats: { count: number; shared: number; mentioned: number };
  onEdit: (id: number) => void;
  onToggleShare: (entry: JournalEntry) => void;
  onCreate: () => void;
  onQuickPublish: (
    content: string,
    share: boolean,
    extras: { category: JournalCategory; linkedIds: number[]; photoFile: File | null },
  ) => Promise<void>;
}

function FeedView(p: FeedProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'flex-start' }}>
      <div>
        {p.loading ? (
          <div className="card" style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
        ) : !p.hasEntries ? (
          <EmptyState onCreate={p.onCreate} />
        ) : (
          p.days.map((day) => (
            <div key={day.key} style={{ marginBottom: 28 }}>
              <div style={{
                position: 'sticky', top: 0, background: 'var(--bg)',
                paddingBottom: 8, zIndex: 2,
              }}>
                <div className="serif" style={{ fontSize: 17, fontWeight: 500, letterSpacing: -0.2 }}>
                  {day.label}
                </div>
              </div>
              {day.entries.map((entry) => (
                <EntryCard
                  key={entry.id} entry={entry}
                  onEdit={() => p.onEdit(entry.id)}
                  onToggleShare={() => p.onToggleShare(entry)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <QuickCompose
        currentUser={p.currentUser}
        residents={p.residents}
        stats={p.weekStats}
        onPublish={p.onQuickPublish}
      />
    </div>
  );
}

/* ─── Quick composer (sidebar) ──────────────────────────────── */

interface QuickComposeProps {
  currentUser: string;  // kept for author attribution in onPublish (used by caller)
  residents: Resident[];
  stats: { count: number; shared: number; mentioned: number };
  onPublish: (
    content: string,
    share: boolean,
    extras: { category: JournalCategory; linkedIds: number[]; photoFile: File | null },
  ) => Promise<void>;
}

function QuickCompose({ residents, stats, onPublish }: QuickComposeProps) {
  const [text, setText] = useState('');
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<JournalCategory>('prep');
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resOpen, setResOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function publish() {
    if (!text.trim() || busy) return;
    setBusy(true);
    await onPublish(text, share, { category, linkedIds, photoFile });
    setText('');
    setCategory('prep');
    setLinkedIds([]);
    setPhotoFile(null);
    setBusy(false);
  }

  const taggedResidents = residents.filter((r) => linkedIds.includes(r.id));

  return (
    <aside style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        .journal-quick-compose::placeholder {
          color: var(--ink-3);
          font-style: italic;
          opacity: 1;
        }
      `}</style>
      <div className="card" style={{ padding: 18 }}>
        <div className="eyebrow">Nouvelle note — rapide</div>
        <textarea
          className="journal-quick-compose"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Qu'est-ce qui s'est passé ?"
          rows={4}
          style={{
            width: '100%', marginTop: 10, padding: 12, borderRadius: 8,
            background: 'var(--surface-2)', color: 'var(--ink)',
            fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6,
            border: 'none', outline: 'none', resize: 'vertical', minHeight: 100,
          }}
        />

        {/* Active tags preview */}
        {(category !== 'prep' || taggedResidents.length > 0 || photoFile) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {category !== 'prep' && (
              <span className={`chip ${category}`} style={{ fontSize: 10.5 }}>
                {CATEGORIES[category]}
                <button
                  type="button"
                  onClick={() => setCategory('prep')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex', marginLeft: 4 }}
                  aria-label="Retirer"
                >
                  <X size={9} />
                </button>
              </span>
            )}
            {taggedResidents.map((r) => (
              <span key={r.id} className={`chip ${category}`} style={{ fontSize: 10.5 }}>
                {r.display_name}
                <button
                  type="button"
                  onClick={() => setLinkedIds((prev) => prev.filter((id) => id !== r.id))}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex', marginLeft: 4 }}
                  aria-label="Retirer"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            {photoFile && (
              <span className="chip ghost" style={{ fontSize: 10.5 }}>
                <Image size={10} /> {photoFile.name.slice(0, 24)}
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex', marginLeft: 4 }}
                  aria-label="Retirer"
                >
                  <X size={9} />
                </button>
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', position: 'relative' }}>
          {/* Résident popover */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn sm"
              title="Tagger un résident"
              onClick={() => { setResOpen((v) => !v); setCatOpen(false); }}
              style={{ color: linkedIds.length > 0 ? 'var(--terra-deep)' : undefined }}
            >
              <UsersIcon size={12} />
              {linkedIds.length > 0 && <span className="num" style={{ fontSize: 10 }}>{linkedIds.length}</span>}
            </button>
            {resOpen && (
              <div
                className="card"
                style={{
                  position: 'absolute', left: 0, top: 32, zIndex: 30,
                  padding: 10, minWidth: 220, maxHeight: 260, overflowY: 'auto',
                  boxShadow: 'var(--shadow-md)',
                }}
                onMouseLeave={() => setResOpen(false)}
              >
                <div className="eyebrow" style={{ marginBottom: 6 }}>Résidents</div>
                {residents.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                    Aucun résident.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {residents.map((r) => {
                      const on = linkedIds.includes(r.id);
                      return (
                        <button
                          key={r.id} type="button"
                          onClick={() => setLinkedIds((prev) => on ? prev.filter((id) => id !== r.id) : [...prev, r.id])}
                          className={on ? `chip ${category}` : 'chip ghost'}
                          style={{ border: 'none', cursor: 'pointer', fontSize: 11 }}
                        >
                          {r.display_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Catégorie popover */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn sm"
              title="Tagger une catégorie"
              onClick={() => { setCatOpen((v) => !v); setResOpen(false); }}
              style={{ color: category !== 'prep' ? 'var(--terra-deep)' : undefined }}
            >
              <Sparkles size={12} />
            </button>
            {catOpen && (
              <div
                className="card"
                style={{
                  position: 'absolute', left: 0, top: 32, zIndex: 30,
                  padding: 10, minWidth: 180,
                  boxShadow: 'var(--shadow-md)',
                }}
                onMouseLeave={() => setCatOpen(false)}
              >
                <div className="eyebrow" style={{ marginBottom: 6 }}>Catégorie</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {CATEGORY_KEYS.map((k) => {
                    const on = category === k;
                    return (
                      <button
                        key={k} type="button"
                        onClick={() => { setCategory(k); setCatOpen(false); }}
                        className={on ? `chip ${k}` : 'chip ghost'}
                        style={{ border: 'none', cursor: 'pointer', fontSize: 11 }}
                      >
                        {CATEGORIES[k]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Photo picker */}
          <button
            type="button"
            className="btn sm"
            title="Joindre une photo"
            onClick={() => fileInputRef.current?.click()}
            style={{ color: photoFile ? 'var(--terra-deep)' : undefined }}
          >
            <Image size={12} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />

          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> partager
          </label>
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={publish}
          disabled={!text.trim() || busy}
          style={{
            width: '100%', marginTop: 10, justifyContent: 'center',
            opacity: !text.trim() || busy ? 0.5 : 1,
            cursor: !text.trim() || busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Publication…' : 'Publier'}
        </button>
      </div>

      <div className="card-soft" style={{ padding: 16 }}>
        <div className="eyebrow">Cette semaine</div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.9, color: 'var(--ink-2)' }}>
          <Stat label="Notes rédigées"       value={stats.count} />
          <Stat label="Partagées équipe"     value={stats.shared} />
          <Stat label="Résidents mentionnés" value={stats.mentioned} />
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span className="num" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* ─── Entry card (feed) ──────────────────────────────────────── */

interface EntryCardProps {
  entry: JournalEntry;
  onEdit: () => void;
  onToggleShare: () => void;
}

function EntryCard({ entry, onEdit, onToggleShare }: EntryCardProps) {
  const shared = entry.is_shared === 1;
  const tags = entry.tags.split(',').map((t) => t.trim()).filter(Boolean);
  const titleDisplay = entry.title || entry.content.slice(0, 60);
  const bodyDisplay = entry.title ? entry.content : '';

  return (
    <div
      className="card"
      onClick={onEdit}
      style={{ padding: 18, marginBottom: 10, position: 'relative', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {entry.time && (
          <div className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
            {entry.time}
          </div>
        )}
        {entry.time && entry.author && (
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-4)' }} />
        )}
        {entry.author && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{entry.author}</div>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={(e) => { e.stopPropagation(); onToggleShare(); }}
          className={shared ? 'chip ghost' : 'chip warn no-dot'}
          title={shared ? 'Cliquer pour rendre privée' : 'Cliquer pour partager'}
          style={{
            fontSize: 10.5, border: 'none', cursor: 'pointer',
            background: shared ? undefined : 'var(--surface-2)',
            color: shared ? undefined : 'var(--ink-3)',
          }}
        >
          {shared ? <UsersIcon size={10} /> : <Pin size={10} />}
          {shared ? 'équipe' : 'privée'}
        </button>
      </div>

      <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.1, marginBottom: 4 }}>
        {titleDisplay}
      </div>
      {bodyDisplay && (
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {bodyDisplay}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
          {tags.map((t, k) => (
            <span key={k} className={`chip ${tagChipClass(t)}`} style={{ fontSize: 10.5 }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── By-resident view ───────────────────────────────────────── */

interface ByResidentProps {
  residents: Resident[];
  selectedResidentId: number | null;
  onSelectResident: (id: number | null) => void;
  filtered: JournalEntry[];
  loading: boolean;
  onEdit: (id: number) => void;
  onCreate: () => void;
}

function ByResidentView(p: ByResidentProps) {
  const resident = p.residents.find((r) => r.id === p.selectedResidentId) ?? null;
  const notes = p.filtered;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, height: 'calc(100vh - 190px)' }}>
      <div className="card" style={{ overflow: 'auto' }}>
        {p.residents.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
            Aucun résident.
          </div>
        ) : (
          p.residents.map((r) => {
            const active = r.id === p.selectedResidentId;
            return (
              <button
                key={r.id}
                onClick={() => p.onSelectResident(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 14px', textAlign: 'left',
                  background: active ? 'var(--cat-creative-bg)' : 'transparent',
                  borderTop: 'none', borderRight: 'none',
                  borderBottom: '1px solid var(--line)',
                  borderLeft: `3px solid ${active ? 'var(--cat-creative)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: active ? 'var(--cat-creative)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {initials(r.display_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5, color: active ? 'var(--cat-creative)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.display_name}
                  </div>
                  {r.room_number && (
                    <div className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      ch. {r.room_number}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="card" style={{ padding: 28, overflow: 'auto' }}>
        {!resident ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Sélectionnez un résident.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <div className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: -0.6 }}>
                {resident.display_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                · {notes.length} note{notes.length > 1 ? 's' : ''}
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn sm" onClick={p.onCreate}><Plus size={11} /> Note</button>
            </div>

            {p.loading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
            ) : notes.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                Aucune note pour ce résident.
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 22 }}>
                <div style={{ position: 'absolute', left: 5, top: 10, bottom: 10, width: 2, background: 'var(--line)' }} />
                {notes.map((n) => (
                  <TimelineItem
                    key={n.id} note={n}
                    onEdit={() => p.onEdit(n.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ note, onEdit }: { note: JournalEntry; onEdit: () => void }) {
  const cat: JournalCategory = note.category ?? 'prep';
  const titleChip = note.title || (note.content.split('\n')[0].slice(0, 40));

  return (
    <div
      onClick={onEdit}
      style={{ position: 'relative', marginBottom: 20, cursor: 'pointer' }}
    >
      <div style={{
        position: 'absolute', left: -22, top: 6,
        width: 12, height: 12, borderRadius: '50%',
        background: `var(--cat-${cat})`, border: '2px solid var(--surface)',
        boxShadow: `0 0 0 2px var(--cat-${cat}-bg)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div className="num" style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {timelineDateLabel(note.date, note.time)}
        </div>
        {titleChip && <span className={`chip ${cat}`} style={{ fontSize: 10.5 }}>{titleChip}</span>}
        <div style={{ flex: 1 }} />
        {note.is_shared !== 1 && <Pin size={12} style={{ color: 'var(--ink-4)' }} />}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
        {note.content}
      </div>
    </div>
  );
}

/* ─── Shared bits ────────────────────────────────────────────── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card" style={{
      padding: 48, textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>
        Aucune note pour le moment
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, maxWidth: 360 }}>
        Notez ce qui s'est passé — quelques lignes par jour suffisent.
      </p>
      <button className="btn primary" onClick={onCreate} style={{ marginTop: 6 }}>
        <Plus size={13} strokeWidth={2.5} /> Rédiger la première note
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--line)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)',
  color: 'var(--ink)', outline: 'none',
};

function filterItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px', borderRadius: 6,
    background: active ? 'var(--surface-2)' : 'transparent',
    border: 'none', cursor: 'pointer', textAlign: 'left',
    fontSize: 12.5, color: 'var(--ink-2)', width: '100%',
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
