import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Trash2, X,
  ChevronDown, AlertTriangle, Pencil,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import {
  getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem,
} from '@/db/inventory';
import {
  ensureCategoryColors, autoColor, categoryLabel,
  type CategoryColor,
} from '@/db/categoryColors';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import type { InventoryItem, InventoryCategory, InventoryCondition } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

const CONDITIONS: Record<InventoryCondition, { label: string; color: string }> = {
  neuf:        { label: 'Neuf',         color: '#059669' },
  bon:         { label: 'Bon état',     color: '#1E40AF' },
  usage:       { label: 'Usagé',        color: '#D97706' },
  a_remplacer: { label: 'À remplacer',  color: '#DC2626' },
};

const CONDITION_KEYS = Object.keys(CONDITIONS) as InventoryCondition[];

// ─── Component ───────────────────────────────────────────────

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<InventoryCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.add);
  const syncStatus = useSyncStore((s) => s.modules.inventory.status);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await getInventoryItems();
        setItems(rows);
        const cats = await ensureCategoryColors('inventory', rows.map((r) => r.category));
        setCategories(cats);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [syncStatus]);

  const categoryMap = new Map(categories.map((c) => [c.name, c]));
  function catFor(name: string): CategoryColor {
    const existing = categoryMap.get(name);
    if (existing) return existing;
    const { color, bg } = autoColor(name);
    return { module: 'inventory', name, color, bg, label: null };
  }

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
      external_id: null,
      inventory_type: 'durable' as const,
    };

    try {
      if (editId) {
        await updateInventoryItem(editId, data).catch(() => {});
        setItems((prev) => prev.map((it) => it.id === editId ? { ...it, ...data } : it));
        addToast('Article mis à jour', 'success');
      } else {
        const id = await createInventoryItem(data).catch(() => Date.now());
        setItems((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() } as InventoryItem, ...prev]);
        addToast('Article ajouté', 'success');
      }
      const cats = await ensureCategoryColors('inventory', [data.category]);
      setCategories(cats);
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
          <SyncStatus module="inventory" />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <SyncButton module="inventory" />
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
            {categories.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
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
              const cat = catFor(item.category);
              const cond = CONDITIONS[item.condition] ?? CONDITIONS.bon;
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
                      {categoryLabel(cat)}
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
                  <input
                    name="category"
                    list="inventory-categories"
                    defaultValue={editItem?.category ?? (categories[0]?.name ?? 'other')}
                    placeholder="Tapez ou choisissez..."
                    style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <datalist id="inventory-categories">
                    {categories.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
                  </datalist>
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
