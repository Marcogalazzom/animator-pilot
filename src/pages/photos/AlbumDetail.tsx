import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Plus, Calendar, Trash2, Mail, Users, Pin, Folder, Pencil, X, Search,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useToastStore } from '@/stores/toastStore';
import {
  getAlbum, getAlbums, getPhotos, createPhoto, updatePhoto, deletePhoto,
  ensureFamileoMonthAlbum, countPhotosByFilePath,
} from '@/db/photos';
import { getResidents } from '@/db/residents';
import {
  ensureCategoryColors, listCategoryColors, categoryLabel, type CategoryColor,
} from '@/db/categoryColors';
import { storePhoto, deletePhotoFiles } from '@/utils/photoStorage';
import { tagChipClass } from '@/utils/tagColor';
import type { PhotoAlbum, Photo, Resident } from '@/db/types';
import PhotoGrid from './PhotoGrid';
import Lightbox from './Lightbox';

interface Props {
  albumId: number;
  onBack: () => void;
  onEditAlbum: (album: PhotoAlbum) => void;
}

type PickerKind = 'resident' | 'category' | 'album' | null;

interface PickerOption {
  value: string;       // id or name
  label: string;
  sub?: string;
  color?: string;
  bg?: string;
  chipClass?: string;
}

function formatFullDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Ajoute un tag (prefixé @ ou #) en début de caption, sans doublon. */
function prefixCaption(current: string, tag: string): string {
  const existing = current.trim();
  if (!existing) return tag;
  // Évite le doublon du même tag
  const parts = existing.split(/\s+/);
  if (parts.includes(tag)) return existing;
  return `${tag} ${existing}`;
}

export default function AlbumDetail({ albumId, onBack, onEditAlbum }: Props) {
  const [album, setAlbum] = useState<PhotoAlbum | null>(null);
  const [category, setCategory] = useState<CategoryColor | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [pickerOptions, setPickerOptions] = useState<PickerOption[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const addToast = useToastStore((s) => s.add);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([getAlbum(albumId), getPhotos(albumId)]);
      setAlbum(a); setPhotos(p);
      if (a?.activity_type) {
        const cats = await ensureCategoryColors('activities', [a.activity_type]).catch(() => []);
        setCategory(cats.find((c) => c.name === a.activity_type) ?? null);
      } else {
        setCategory(null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [albumId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleAddPhotos() {
    if (uploading) return;
    let picked: string | string[] | null;
    try {
      picked = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
    } catch (err) {
      addToast(`Erreur dialog : ${String(err).slice(0, 80)}`, 'error');
      return;
    }
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    if (paths.length === 0) return;

    setUploading(true);
    let ok = 0, fail = 0;
    for (const srcPath of paths) {
      try {
        const { filePath, thumbnailPath } = await storePhoto(srcPath);
        await createPhoto({
          album_id: albumId,
          file_path: filePath,
          thumbnail_path: thumbnailPath,
          caption: '',
          taken_at: new Date().toISOString(),
        });
        ok++;
      } catch (err) {
        console.error('Photo upload failed', err);
        fail++;
      }
    }
    setUploading(false);
    if (ok > 0) addToast(`${ok} photo${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''}`, 'success');
    if (fail > 0) addToast(`${fail} échec${fail > 1 ? 's' : ''} d'upload`, 'error');
    await refresh();
  }

  async function handleCaption(id: number, caption: string) {
    await updatePhoto(id, { caption }).catch(() => {});
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, caption } : p));
  }

  async function handleDeletePhoto(id: number) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    await deletePhoto(id).catch(() => {});
    // Ne supprime le fichier physique que si aucune autre photo (ex. copie
    // Famileo du mois) ne l'utilise.
    const stillUsed = await countPhotosByFilePath(p.file_path).catch(() => 1);
    if (stillUsed === 0) await deletePhotoFiles(p.file_path, p.thumbnail_path);
    addToast('Photo supprimée', 'success');
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedIds(new Set(photos.map((p) => p.id))); }
  function clearSelection() { setSelectedIds(new Set()); }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} photo${selectedIds.size > 1 ? 's' : ''} ?`)) return;
    const targets = photos.filter((p) => selectedIds.has(p.id));
    let ok = 0, fail = 0;
    for (const p of targets) {
      try {
        await deletePhoto(p.id);
        const stillUsed = await countPhotosByFilePath(p.file_path).catch(() => 1);
        if (stillUsed === 0) await deletePhotoFiles(p.file_path, p.thumbnail_path);
        ok++;
      } catch { fail++; }
    }
    if (ok > 0) addToast(`${ok} photo${ok > 1 ? 's' : ''} supprimée${ok > 1 ? 's' : ''}`, 'success');
    if (fail > 0) addToast(`${fail} échec${fail > 1 ? 's' : ''} de suppression`, 'error');
    setSelectedIds(new Set());
    await refresh();
  }

  /** Déplace les photos sélectionnées dans l'album cible. */
  async function moveSelectedTo(targetAlbumId: number, successMessage: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await updatePhoto(id, { album_id: targetAlbumId });
        ok++;
      } catch { fail++; }
    }
    if (ok > 0) addToast(`${successMessage} (${ok})`, 'success');
    if (fail > 0) addToast(`${fail} échec${fail > 1 ? 's' : ''}`, 'error');
    setSelectedIds(new Set());
    await refresh();
  }

  /** Ajoute un préfixe de tag dans la caption des photos sélectionnées. */
  async function tagSelectedCaptions(tag: string, successMessage: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let ok = 0;
    for (const id of ids) {
      const p = photos.find((x) => x.id === id);
      if (!p) continue;
      const next = prefixCaption(p.caption ?? '', tag);
      try {
        await updatePhoto(id, { caption: next });
        ok++;
      } catch { /* ignore */ }
    }
    if (ok > 0) {
      addToast(`${successMessage} (${ok})`, 'success');
      await refresh();
    }
  }

  /* ─── Sidebar actions ───────────────────────────────────── */

  async function handleAddToFamileo() {
    if (selectedIds.size === 0 || pickerBusy) return;
    setPickerBusy(true);
    try {
      const now = new Date();
      const target = await ensureFamileoMonthAlbum(now.getFullYear(), now.getMonth() + 1);
      if (target.id === albumId) {
        addToast('Ces photos sont déjà dans l\'album Famileo du mois', 'info');
        return;
      }
      // Copie : on crée de nouvelles lignes dans l'album Famileo en pointant
      // sur les mêmes fichiers physiques — la photo d'origine reste dans
      // son album. La suppression est protégée par countPhotosByFilePath.
      const targets = photos.filter((p) => selectedIds.has(p.id));
      const existing = await getPhotos(target.id).catch(() => []);
      const existingPaths = new Set(existing.map((p) => p.file_path));
      let ok = 0, skipped = 0, fail = 0;
      for (const p of targets) {
        if (existingPaths.has(p.file_path)) { skipped++; continue; }
        try {
          await createPhoto({
            album_id: target.id,
            file_path: p.file_path,
            thumbnail_path: p.thumbnail_path,
            caption: p.caption ?? '',
            taken_at: p.taken_at,
          });
          ok++;
        } catch { fail++; }
      }
      if (ok > 0) addToast(`${ok} photo${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''} au Famileo du mois`, 'success');
      if (skipped > 0) addToast(`${skipped} déjà présente${skipped > 1 ? 's' : ''} dans le Famileo`, 'info');
      if (fail > 0) addToast(`${fail} échec${fail > 1 ? 's' : ''}`, 'error');
      setSelectedIds(new Set());
    } catch {
      addToast('Erreur lors de l\'ajout au Famileo', 'error');
    } finally {
      setPickerBusy(false);
    }
  }

  async function openResidentPicker() {
    if (selectedIds.size === 0) return;
    const list = await getResidents().catch(() => [] as Resident[]);
    setPickerOptions(list.map((r) => ({
      value: r.display_name,
      label: r.display_name,
      sub: r.unit || (r.room_number ? `ch. ${r.room_number}` : ''),
      chipClass: tagChipClass(r.display_name),
    })));
    setPickerKind('resident');
  }

  async function openCategoryPicker() {
    if (selectedIds.size === 0) return;
    const cats = await listCategoryColors('activities').catch(() => []);
    setPickerOptions(cats.map((c) => ({
      value: c.name,
      label: c.label ?? c.name,
      color: c.color,
      bg: c.bg,
    })));
    setPickerKind('category');
  }

  async function openAlbumPicker() {
    if (selectedIds.size === 0) return;
    const all = await getAlbums().catch(() => []);
    setPickerOptions(all
      .filter((a) => a.id !== albumId)
      .map((a) => ({
        value: String(a.id),
        label: a.title,
        sub: a.activity_date ? formatFullDate(a.activity_date) : '',
      })),
    );
    setPickerKind('album');
  }

  async function handlePick(value: string) {
    const kind = pickerKind;
    setPickerKind(null);
    setPickerOptions([]);
    if (kind === 'resident') {
      const firstName = value.split(/\s+/)[0];
      await tagSelectedCaptions(`@${firstName}`, `Photos associées à ${firstName}`);
    } else if (kind === 'category') {
      const meta = pickerOptions.find((o) => o.value === value);
      await tagSelectedCaptions(`#${meta?.label ?? value}`, 'Activité taggée');
    } else if (kind === 'album') {
      const targetId = Number(value);
      if (Number.isFinite(targetId)) {
        await moveSelectedTo(targetId, 'Photos déplacées');
      }
    }
  }

  const allSelected = useMemo(
    () => photos.length > 0 && selectedIds.size === photos.length,
    [photos.length, selectedIds.size],
  );

  if (loading || !album) {
    return <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={onBack} className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={13} /> Retour aux albums
      </button>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <div className="eyebrow">Album</div>
        <div className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: -0.7 }}>
          {album.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {photos.length} photo{photos.length > 1 ? 's' : ''}
          {category && <> · <span style={{ color: category.color }}>{categoryLabel(category)}</span></>}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={handleAddPhotos} disabled={uploading} className="btn sm">
          <Plus size={12} /> {uploading ? 'Import…' : 'Importer'}
        </button>
        <button onClick={() => onEditAlbum(album)} className="btn sm">
          <Pencil size={12} /> Modifier l'album
        </button>
      </div>

      {/* 2-col grid : photos + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <PhotoGrid
          photos={photos}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenLightbox={(i) => setLightboxIndex(i)}
        />

        {/* Sidebar */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          position: 'sticky', top: 16, alignSelf: 'flex-start',
        }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow">Sélection</div>
            <div className="serif" style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.8, marginTop: 2 }}>
              {selectedIds.size} photo{selectedIds.size > 1 ? 's' : ''}
            </div>
            {photos.length > 0 && (
              <button
                onClick={allSelected ? clearSelection : selectAll}
                className="btn ghost sm"
                style={{ marginTop: 6, padding: 0, justifyContent: 'flex-start' }}
              >
                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
              <button className="btn primary" style={{ justifyContent: 'flex-start' }}
                disabled={selectedIds.size === 0 || pickerBusy} onClick={handleAddToFamileo}>
                <Mail size={14} /> Ajouter au Famileo
              </button>
              <button className="btn" style={{ justifyContent: 'flex-start' }}
                disabled={selectedIds.size === 0} onClick={openResidentPicker}>
                <Users size={14} /> Associer à un résident
              </button>
              <button className="btn" style={{ justifyContent: 'flex-start' }}
                disabled={selectedIds.size === 0} onClick={openCategoryPicker}>
                <Pin size={14} /> Tagger l'activité
              </button>
              <button className="btn" style={{ justifyContent: 'flex-start' }}
                disabled={selectedIds.size === 0} onClick={openAlbumPicker}>
                <Folder size={14} /> Déplacer vers…
              </button>
              <hr className="divider" style={{ margin: '8px 0' }} />
              <button
                className="btn"
                style={{
                  justifyContent: 'flex-start', color: 'var(--danger)',
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                }}
                disabled={selectedIds.size === 0}
                onClick={deleteSelected}
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>

          <div className="card-soft" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Détails de l'album</div>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              {album.activity_type && (
                <div>
                  <span style={{ color: 'var(--ink-3)' }}>Activité</span> ·{' '}
                  {category ? categoryLabel(category) : album.activity_type}
                </div>
              )}
              {album.activity_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--ink-3)' }}>Date</span> ·{' '}
                  <Calendar size={11} style={{ color: 'var(--ink-4)' }} />{' '}
                  {formatFullDate(album.activity_date)}
                </div>
              )}
              {album.description && (
                <div style={{ marginTop: 8, color: 'var(--ink-2)', fontStyle: 'italic' }}>
                  {album.description}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Picker modal */}
      {pickerKind && (
        <PickerModal
          title={
            pickerKind === 'resident' ? 'Associer à un résident' :
            pickerKind === 'category' ? 'Tagger l\'activité' :
            'Déplacer vers un album'
          }
          options={pickerOptions}
          onClose={() => { setPickerKind(null); setPickerOptions([]); }}
          onPick={handlePick}
        />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onCaption={handleCaption}
          onDelete={async (id) => {
            await handleDeletePhoto(id);
            setLightboxIndex(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Picker modal (shared for résident / activité / album) ─── */

interface PickerModalProps {
  title: string;
  options: PickerOption[];
  onClose: () => void;
  onPick: (value: string) => void;
}

function PickerModal({ title, options, onClose, onPick }: PickerModalProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q),
    );
  }, [query, options]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(35,29,24,0.4)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className="card"
        style={{ width: 460, maxHeight: '75vh', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{title}</h2>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Fermer">
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', borderRadius: 999, padding: '6px 12px',
          }}>
            <Search size={14} style={{ color: 'var(--ink-3)' }} />
            <input
              type="text" placeholder="Rechercher…"
              value={query} onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13 }}
              autoFocus
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun résultat
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                onClick={() => onPick(o.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
              >
                {o.chipClass ? (
                  <span className={`chip ${o.chipClass}`} style={{ fontSize: 11 }}>
                    {o.label.split(/\s+/)[0][0]?.toUpperCase() ?? '?'}
                  </span>
                ) : o.color ? (
                  <span style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: o.bg ?? 'transparent',
                    border: `1px solid ${o.color}`, flexShrink: 0,
                  }} />
                ) : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: o.color ?? 'var(--ink)' }}>
                    {o.label}
                  </div>
                  {o.sub && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{o.sub}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
