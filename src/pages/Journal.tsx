import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Trash2, X, Pencil, Search, Tag,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
} from '@/db/journal';
import type { JournalEntry, JournalMood } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

const MOODS: Record<JournalMood, { label: string; emoji: string; color: string }> = {
  great:     { label: 'Super',     emoji: '\u2600\uFE0F', color: '#059669' },
  good:      { label: 'Bien',      emoji: '\uD83D\uDE0A', color: '#1E40AF' },
  neutral:   { label: 'Neutre',    emoji: '\uD83D\uDE10', color: '#64748B' },
  difficult: { label: 'Difficile', emoji: '\uD83D\uDE15', color: '#D97706' },
  bad:       { label: 'Mauvais',   emoji: '\uD83D\uDE1E', color: '#DC2626' },
};

const MOOD_KEYS = Object.keys(MOODS) as JournalMood[];

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.add);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getJournalEntries()
      .then((rows) => setEntries(rows))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.content.toLowerCase().includes(q) || e.tags.toLowerCase().includes(q);
  });

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      date: fd.get('date') as string,
      content: fd.get('content') as string,
      mood: fd.get('mood') as JournalMood,
      tags: fd.get('tags') as string,
    };

    try {
      if (editId) {
        await updateJournalEntry(editId, data).catch(() => {});
        setEntries((prev) => prev.map((e) => e.id === editId ? { ...e, ...data } : e));
        addToast('Entrée mise à jour', 'success');
      } else {
        const id = await createJournalEntry(data).catch(() => Date.now());
        setEntries((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() }, ...prev]);
        addToast('Entrée ajoutée', 'success');
      }
    } catch {
      addToast('Erreur', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteJournalEntry(id).catch(() => {});
    setEntries((prev) => prev.filter((e) => e.id !== id));
    addToast('Entrée supprimée', 'success');
  }

  const editItem = editId ? entries.find((e) => e.id === editId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Carnet de bord
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Notes quotidiennes — privé, non synchronisé
          </p>
        </div>
        <button onClick={() => { setEditId(null); setShowForm(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', backgroundColor: 'var(--color-primary)',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}>
          <Plus size={14} /> Nouvelle entrée
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
        <input type="text" placeholder="Rechercher dans le journal..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px 8px 32px',
            border: '1px solid var(--color-border)', borderRadius: '6px',
            fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)',
          }} />
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <BookOpen size={36} style={{ color: 'var(--color-border)', marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Aucune entrée. Commencez votre journal !</p>
          </div>
        ) : filtered.map((entry) => {
          const mood = MOODS[entry.mood];
          return (
            <div key={entry.id} style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px',
              borderLeft: `3px solid ${mood.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>{mood.emoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                      {formatDate(entry.date)}
                    </p>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: mood.color }}>{mood.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setEditId(entry.id); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {entry.content}
              </p>

              {entry.tags && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {entry.tags.split(',').map((tag, i) => (
                    <span key={i} style={{
                      fontSize: '11px', color: 'var(--color-primary)',
                      backgroundColor: 'rgba(30,64,175,0.08)', padding: '2px 6px',
                      borderRadius: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px',
                    }}>
                      <Tag size={9} /> {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => { setShowForm(false); setEditId(null); }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                {editId ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={18} /></button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Date
                  <input name="date" type="date" defaultValue={editItem?.date ?? new Date().toISOString().slice(0, 10)} required
                    style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Humeur
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    {MOOD_KEYS.map((k) => (
                      <label key={k} style={{ cursor: 'pointer', textAlign: 'center' }}>
                        <input type="radio" name="mood" value={k} defaultChecked={editItem ? editItem.mood === k : k === 'good'} style={{ display: 'none' }} />
                        <span style={{ fontSize: '22px', display: 'block', opacity: 0.7, transition: 'opacity 0.15s' }}
                          title={MOODS[k].label}>
                          {MOODS[k].emoji}
                        </span>
                      </label>
                    ))}
                  </div>
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes de la journée
                <textarea name="content" rows={6} defaultValue={editItem?.content ?? ''} required
                  placeholder="Ce qui s'est passé, ce qui a marché, idées pour demain..."
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical', lineHeight: 1.6 }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Tags (séparés par des virgules)
                <input name="tags" defaultValue={editItem?.tags ?? ''} placeholder="peinture, réunion, idée..."
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <button type="submit" style={{
                padding: '10px', backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: '4px',
              }}>
                {editId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
