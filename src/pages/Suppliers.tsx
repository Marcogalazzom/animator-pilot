import { useState, useEffect, useRef } from 'react';
import {
  Store, Plus, Search, Trash2, X, ChevronDown, Pencil,
  Phone, Mail, MapPin, Globe, Star,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier, toggleFavorite,
} from '@/db/suppliers';
import type { Supplier, SupplierCategory } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

const CATEGORIES: Record<SupplierCategory, { label: string; color: string; bg: string }> = {
  alimentation:  { label: 'Alimentation',       color: '#EA580C', bg: '#FFF7ED' },
  materiel:      { label: 'Matériel / Loisirs',  color: '#1E40AF', bg: '#EFF6FF' },
  transport:     { label: 'Transport',           color: '#059669', bg: '#ECFDF5' },
  spectacle:     { label: 'Spectacle / Artiste', color: '#7C3AED', bg: '#F5F3FF' },
  formation:     { label: 'Formation',           color: '#D97706', bg: '#FFFBEB' },
  location:      { label: 'Location matériel',   color: '#0F766E', bg: '#F0FDFA' },
  other:         { label: 'Autre',               color: '#64748B', bg: '#F1F5F9' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as SupplierCategory[];

const MOCK_SUPPLIERS: Supplier[] = [
  { id: 1, name: 'Cultura', category: 'materiel', contact_name: '', phone: '05 62 00 00 00', email: '', address: 'Centre commercial', website: 'cultura.com', notes: 'Peinture, papier, jeux', is_favorite: 1, created_at: '' },
  { id: 2, name: 'Transport Express', category: 'transport', contact_name: 'M. Dupuis', phone: '06 12 34 56 78', email: 'contact@transport-express.fr', address: '12 rue de la Gare', website: '', notes: 'Bus adapté PMR, devis à demander 3 semaines avant', is_favorite: 1, created_at: '' },
  { id: 3, name: 'Boulangerie Petit', category: 'alimentation', contact_name: 'Mme Petit', phone: '05 61 00 00 00', email: '', address: '3 place du Marché', website: '', notes: 'Gâteaux anniversaires, commande 48h avant', is_favorite: 0, created_at: '' },
  { id: 4, name: 'Marie Martin - Musicothérapeute', category: 'spectacle', contact_name: 'Marie Martin', phone: '06 23 45 67 89', email: 'marie.martin@gmail.com', address: '', website: '', notes: 'Séances de 1h30, tarif 160 EUR/séance', is_favorite: 1, created_at: '' },
  { id: 5, name: 'Sophie Duval - Art-thérapeute', category: 'spectacle', contact_name: 'Sophie Duval', phone: '06 34 56 78 90', email: 'sophie.duval@art-therapie.fr', address: '', website: 'art-therapie-toulouse.fr', notes: 'Spécialiste personnes âgées, 250 EUR/séance', is_favorite: 0, created_at: '' },
  { id: 6, name: 'Jardin Botanique', category: 'other', contact_name: 'Accueil groupes', phone: '05 62 11 22 33', email: 'groupes@jardin-botanique.fr', address: '25 allée des Platanes', website: '', notes: 'Tarif groupe : 5 EUR/personne, gratuit accompagnateurs', is_favorite: 0, created_at: '' },
];

// ─── Component ───────────────────────────────────────────────

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(MOCK_SUPPLIERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<SupplierCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getSuppliers()
      .then((rows) => { if (rows.length > 0) setSuppliers(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter((s) => {
    if (filterCat && s.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.contact_name.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q);
    }
    return true;
  });

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      name: fd.get('name') as string,
      category: fd.get('category') as SupplierCategory,
      contact_name: fd.get('contact_name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      address: fd.get('address') as string,
      website: fd.get('website') as string,
      notes: fd.get('notes') as string,
      is_favorite: fd.get('is_favorite') === 'on' ? 1 : 0,
    };

    try {
      if (editId) {
        await updateSupplier(editId, data).catch(() => {});
        setSuppliers((prev) => prev.map((s) => s.id === editId ? { ...s, ...data } : s));
        addToast('Fournisseur mis à jour', 'success');
      } else {
        const id = await createSupplier(data).catch(() => Date.now());
        setSuppliers((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() }, ...prev]);
        addToast('Fournisseur ajouté', 'success');
      }
    } catch {
      addToast('Erreur', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteSupplier(id).catch(() => {});
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    addToast('Fournisseur supprimé', 'success');
  }

  async function handleToggleFav(id: number) {
    await toggleFavorite(id).catch(() => {});
    setSuppliers((prev) => prev.map((s) => s.id === id ? { ...s, is_favorite: s.is_favorite ? 0 : 1 } : s));
  }

  const editItem = editId ? suppliers.find((s) => s.id === editId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Fournisseurs
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Carnet d'adresses des prestataires et fournisseurs habituels
          </p>
        </div>
        <button onClick={() => { setEditId(null); setShowForm(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', backgroundColor: 'var(--color-primary)',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input type="text" placeholder="Rechercher..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as SupplierCategory | '')}
            style={{ padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer' }}>
            <option value="">Toutes catégories</option>
            {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
        </div>
      </div>

      {/* Supplier grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucun fournisseur</p>
        ) : filtered.map((s) => {
          const cat = CATEGORIES[s.category] ?? CATEGORIES.other;
          return (
            <div key={s.id} style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px',
              borderLeft: `3px solid ${cat.color}`,
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {s.name}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: cat.color, backgroundColor: cat.bg, padding: '1px 6px', borderRadius: '4px' }}>
                      {cat.label}
                    </span>
                    {s.contact_name && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{s.contact_name}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button onClick={() => handleToggleFav(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: s.is_favorite ? '#D97706' : 'var(--color-border)' }} title="Favori">
                    <Star size={14} fill={s.is_favorite ? '#D97706' : 'none'} />
                  </button>
                  <button onClick={() => { setEditId(s.id); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {s.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} /> {s.phone}</span>}
                {s.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} /> {s.email}</span>}
                {s.address && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} /> {s.address}</span>}
                {s.website && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={11} /> {s.website}</span>}
              </div>

              {s.notes && (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {s.notes}
                </p>
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
                {editId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={18} /></button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Nom de l'entreprise / prestataire
                <input name="name" defaultValue={editItem?.name ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Catégorie
                  <select name="category" defaultValue={editItem?.category ?? 'other'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Personne de contact
                  <input name="contact_name" defaultValue={editItem?.contact_name ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Téléphone
                  <input name="phone" defaultValue={editItem?.phone ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Email
                  <input name="email" type="email" defaultValue={editItem?.email ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Adresse
                <input name="address" defaultValue={editItem?.address ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Site web
                <input name="website" defaultValue={editItem?.website ?? ''} placeholder="www.exemple.fr" style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes (tarifs, délais, remarques...)
                <textarea name="notes" rows={3} defaultValue={editItem?.notes ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input name="is_favorite" type="checkbox" defaultChecked={editItem ? editItem.is_favorite === 1 : false} />
                Favori
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
