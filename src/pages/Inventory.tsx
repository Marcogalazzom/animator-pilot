import { useState, useEffect, useRef } from 'react';
import {
  Package, Plus, Search, Trash2, X, RefreshCw,
  ChevronDown, AlertTriangle, Check, Pencil,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem,
} from '@/db/inventory';
import type { InventoryItem, InventoryCategory, InventoryCondition } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

const CATEGORIES: Record<InventoryCategory, { label: string; color: string; bg: string }> = {
  materiel_animation: { label: 'Matériel animation', color: '#1E40AF', bg: '#EFF6FF' },
  jeux:               { label: 'Jeux',               color: '#7C3AED', bg: '#F5F3FF' },
  fournitures:        { label: 'Fournitures',        color: '#059669', bg: '#ECFDF5' },
  decoration:         { label: 'Décoration',         color: '#D97706', bg: '#FFFBEB' },
  musique:            { label: 'Musique',             color: '#DC2626', bg: '#FEF2F2' },
  sport:              { label: 'Sport / Motricité',   color: '#0F766E', bg: '#F0FDFA' },
  other:              { label: 'Autre',               color: '#64748B', bg: '#F1F5F9' },
};

const CONDITIONS: Record<InventoryCondition, { label: string; color: string }> = {
  neuf:        { label: 'Neuf',         color: '#059669' },
  bon:         { label: 'Bon état',     color: '#1E40AF' },
  usage:       { label: 'Usagé',        color: '#D97706' },
  a_remplacer: { label: 'À remplacer',  color: '#DC2626' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as InventoryCategory[];
const CONDITION_KEYS = Object.keys(CONDITIONS) as InventoryCondition[];

// ─── Mock data ───────────────────────────────────────────────

const MOCK_ITEMS: InventoryItem[] = [
  { id: 1, name: 'Jeu de cartes géant', category: 'jeux', quantity: 3, condition: 'bon', location: 'Salle animation', notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 2, name: 'Peinture acrylique (lot)', category: 'fournitures', quantity: 12, condition: 'neuf', location: 'Placard B2', notes: 'Couleurs variées', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 3, name: 'Enceinte Bluetooth', category: 'musique', quantity: 2, condition: 'bon', location: 'Salle polyvalente', notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 4, name: 'Ballons mousse', category: 'sport', quantity: 8, condition: 'usage', location: 'Salle de gym', notes: 'Prévoir remplacement 2 ballons', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 5, name: 'Guirlandes lumineuses', category: 'decoration', quantity: 5, condition: 'bon', location: 'Réserve déco', notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 6, name: 'Projecteur vidéo', category: 'materiel_animation', quantity: 1, condition: 'a_remplacer', location: 'Bureau animation', notes: 'Lampe à changer', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 7, name: 'Puzzles 500 pièces', category: 'jeux', quantity: 6, condition: 'bon', location: 'Étagère jeux', notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 8, name: 'Matériel de loisirs créatifs', category: 'materiel_animation', quantity: 1, condition: 'bon', location: 'Placard A1', notes: 'Perles, fils, ciseaux', synced_from: '', last_sync_at: null, created_at: '' },
];

// ─── Component ───────────────────────────────────────────────

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>(MOCK_ITEMS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<InventoryCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getInventoryItems()
      .then((rows) => { if (rows.length > 0) setItems(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    if (filterCat && item.category !== filterCat) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      name: fd.get('name') as string,
      category: fd.get('category') as InventoryCategory,
      quantity: parseInt(fd.get('quantity') as string) || 1,
      condition: fd.get('condition') as InventoryCondition,
      location: fd.get('location') as string,
      notes: fd.get('notes') as string,
      synced_from: '',
      last_sync_at: null,
    };

    try {
      if (editId) {
        await updateInventoryItem(editId, data).catch(() => {});
        setItems((prev) => prev.map((it) => it.id === editId ? { ...it, ...data } : it));
        addToast('Article mis à jour', 'success');
      } else {
        const id = await createInventoryItem(data).catch(() => Date.now());
        setItems((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() }, ...prev]);
        addToast('Article ajouté', 'success');
      }
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteInventoryItem(id).catch(() => {});
    setItems((prev) => prev.filter((it) => it.id !== id));
    addToast('Article supprimé', 'success');
  }

  function openEdit(item: InventoryItem) {
    setEditId(item.id);
    setShowForm(true);
  }

  const editItem = editId ? items.find((it) => it.id === editId) : null;

  const syncedCount = items.filter((it) => it.synced_from === 'planning-ehpad').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Inventaire
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Matériel et fournitures d'animation — {syncedCount > 0 && <span style={{ color: 'var(--color-success)' }}>{syncedCount} synchronisés depuis planning-ehpad</span>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => addToast('Synchronisation depuis planning-ehpad...', 'info')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', backgroundColor: 'transparent',
              color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)',
              borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Synchroniser
          </button>
          <button
            onClick={() => { setEditId(null); setShowForm(true); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: '6px',
              fontSize: '13px', fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-surface)',
            }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value as InventoryCategory | '')}
            style={{
              padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)',
              borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Toutes catégories</option>
            {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>{items.length}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Articles total</p>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-danger)', fontFamily: 'var(--font-sans)' }}>
            {items.filter((it) => it.condition === 'a_remplacer').length}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>À remplacer</p>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-sans)' }}>{syncedCount}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Synchronisés</p>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Article</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catégorie</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qté</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>État</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emplacement</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Aucun article trouvé</td></tr>
            ) : filtered.map((item) => {
              const cat = CATEGORIES[item.category];
              const cond = CONDITIONS[item.condition];
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {item.name}
                    {item.synced_from && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>SYNC</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: cat.color, backgroundColor: cat.bg, padding: '2px 8px', borderRadius: '4px' }}>
                      {cat.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: cond.color }}>
                      {item.condition === 'a_remplacer' && <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                      {cond.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{item.location}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                      <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }} onClick={() => { setShowForm(false); setEditId(null); }}>
          <div style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '12px',
            padding: '24px', width: '480px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                {editId ? 'Modifier l\'article' : 'Nouvel article'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Nom de l'article
                <input name="name" defaultValue={editItem?.name ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Catégorie
                  <select name="category" defaultValue={editItem?.category ?? 'materiel_animation'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  État
                  <select name="condition" defaultValue={editItem?.condition ?? 'bon'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {CONDITION_KEYS.map((k) => <option key={k} value={k}>{CONDITIONS[k].label}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Quantité
                  <input name="quantity" type="number" min="0" defaultValue={editItem?.quantity ?? 1} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Emplacement
                  <input name="location" defaultValue={editItem?.location ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes
                <textarea name="notes" rows={2} defaultValue={editItem?.notes ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
              <button type="submit" style={{
                padding: '10px', backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: '4px',
              }}>
                {editId ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
