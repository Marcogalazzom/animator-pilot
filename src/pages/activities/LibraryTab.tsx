import { useMemo, useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { Plus, MapPin, Users, Pencil, Trash2, Sparkles, Heart, Image as ImageIcon, Mail, Folder, BookOpen } from 'lucide-react';
import ScheduleTemplateModal from './ScheduleTemplateModal';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';
import { duplicateActivity, deleteActivity, updateActivity } from '@/db/activities';
import type { Activity, ActivityCategory, ActivityDifficulty } from '@/db/types';

interface Props {
  templates: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  onCreateTemplate: () => void;
  onEditTemplate: (t: Activity) => void;
  onRefresh: () => Promise<void>;
}

const CATEGORY_META: Record<ActivityCategory, { label: string; Icon: typeof Sparkles; chip: string }> = {
  memory:   { label: 'Mémoire',     Icon: Sparkles,    chip: 'memory' },
  body:     { label: 'Physique',    Icon: Heart,       chip: 'body' },
  creative: { label: 'Créatif',     Icon: ImageIcon,   chip: 'creative' },
  outing:   { label: 'Social',      Icon: Mail,        chip: 'outing' },
  rdv:      { label: 'Sensoriel',   Icon: Folder,      chip: 'rdv' },
  prep:     { label: 'Spectacles',  Icon: BookOpen,    chip: 'prep' },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_META) as ActivityCategory[];

const DIFFICULTY_META: Record<ActivityDifficulty, { label: string; chip: string }> = {
  facile:    { label: 'facile',    chip: 'done' },
  moyen:     { label: 'moyen',     chip: 'warn' },
  difficile: { label: 'difficile', chip: 'danger' },
};

const DIFFICULTY_KEYS = Object.keys(DIFFICULTY_META) as ActivityDifficulty[];

export default function LibraryTab({ templates, types, search, typeFilter, onCreateTemplate, onEditTemplate, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [scheduling, setScheduling] = useState<Activity | null>(null);
  const [activeCategory, setActiveCategory] = useState<ActivityCategory>('memory');
  const [difficultyFilter, setDifficultyFilter] = useState<Set<ActivityDifficulty>>(new Set());

  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  // Counts per category for the rail
  const categoryCounts = useMemo(() => {
    const m: Record<ActivityCategory, number> = { memory: 0, body: 0, creative: 0, outing: 0, rdv: 0, prep: 0 };
    for (const t of templates) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (t.category !== activeCategory) return false;
      if (difficultyFilter.size > 0 && !difficultyFilter.has(t.difficulty)) return false;
      if (typeFilter && t.activity_type !== typeFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [templates, activeCategory, difficultyFilter, typeFilter, search]);

  const totalThisCategory = templates.filter((t) => t.category === activeCategory).length;

  async function schedule(date: string, timeStart: string | null, timeEnd: string | null) {
    if (!scheduling) return;
    const newId = await duplicateActivity(scheduling.id, date);
    await updateActivity(newId, {
      time_start: timeStart, time_end: timeEnd, is_template: 0,
    } as Partial<Activity>);
    addToast('Activité programmée', 'success');
    await onRefresh();
  }

  async function remove(t: Activity) {
    await deleteActivity(t.id).catch(() => {});
    addToast('Modèle supprimé', 'success');
    await onRefresh();
  }

  function toggleDifficulty(d: ActivityDifficulty) {
    setDifficultyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  const activeMeta = CATEGORY_META[activeCategory];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
      {/* Category rail */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="eyebrow" style={{ padding: '0 4px', marginBottom: 6 }}>Catégories</div>
        {CATEGORY_KEYS.map((k) => {
          const meta = CATEGORY_META[k];
          const active = activeCategory === k;
          const count = categoryCounts[k];
          return (
            <button
              key={k}
              onClick={() => setActiveCategory(k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px', borderRadius: 10,
                marginBottom: 2, textAlign: 'left',
                background: active ? `var(--cat-${k}-bg)` : 'transparent',
                color: active ? `var(--cat-${k})` : 'var(--ink-2)',
                fontSize: 14, fontWeight: active ? 600 : 500,
                border: 'none', cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(ev) => !active && (ev.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(ev) => !active && (ev.currentTarget.style.background = 'transparent')}
            >
              <meta.Icon size={16} />
              <span style={{ flex: 1 }}>{meta.label}</span>
              <span className="num" style={{
                fontFamily: 'var(--font-mono)', fontSize: 11.5,
                color: active ? `var(--cat-${k})` : 'var(--ink-3)',
              }}>
                {count}
              </span>
            </button>
          );
        })}

        <div style={{ marginTop: 24 }}>
          <div className="eyebrow" style={{ padding: '0 4px', marginBottom: 8 }}>Filtrer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DIFFICULTY_KEYS.map((d) => (
              <label key={d} style={{
                display: 'flex', gap: 8, fontSize: 13, padding: '4px',
                color: 'var(--ink-2)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={difficultyFilter.has(d)}
                  onChange={() => toggleDifficulty(d)}
                />
                {DIFFICULTY_META[d].label}
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* Main grid */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Catégorie</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: -0.8 }}>
            {activeMeta.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {totalThisCategory} activité{totalThisCategory > 1 ? 's' : ''}
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn primary sm" onClick={onCreateTemplate}>
            <Plus size={12} strokeWidth={2.5} /> Nouveau modèle
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="card" style={{
            padding: 48, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <activeMeta.Icon size={36} style={{ color: 'var(--ink-4)' }} />
            <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>
              Aucun modèle dans cette catégorie
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, maxWidth: 360 }}>
              {difficultyFilter.size > 0
                ? 'Essayez de retirer un filtre, ou créez un nouveau modèle.'
                : 'Créez un premier modèle pour commencer la bibliothèque.'}
            </p>
            <button className="btn primary" onClick={onCreateTemplate} style={{ marginTop: 6 }}>
              <Plus size={13} strokeWidth={2.5} /> Nouveau modèle
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map((t) => {
              const c = typeFor(t.activity_type);
              const meta = CATEGORY_META[t.category];
              const diff = DIFFICULTY_META[t.difficulty];
              const fillPct = t.max_participants > 0
                ? Math.min(100, (t.actual_participants / t.max_participants) * 100)
                : 0;
              return (
                <div key={t.id} className="card" style={{
                  padding: 18, transition: 'box-shadow 0.18s ease', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  onMouseLeave={(ev) => (ev.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `var(--cat-${t.category}-bg)`,
                      color: `var(--cat-${t.category})`,
                      display: 'grid', placeItems: 'center',
                      flexShrink: 0,
                    }}>
                      <meta.Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="serif" style={{
                        fontSize: 17, fontWeight: 500, letterSpacing: -0.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {categoryLabel(c)}
                      </div>
                    </div>
                    <span className={`chip ${diff.chip}`}>{diff.label}</span>
                  </div>

                  {t.description && (
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      {t.description}
                    </div>
                  )}

                  {(t.location || t.max_participants > 0) && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                      {t.location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} /> {t.location}
                        </span>
                      )}
                      {t.max_participants > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Users size={11} /> {t.max_participants} max
                        </span>
                      )}
                    </div>
                  )}

                  {t.max_participants > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        flex: 1, height: 6, background: 'var(--surface-2)',
                        borderRadius: 3, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${fillPct}%`, height: '100%',
                          background: 'var(--terra)',
                        }} />
                      </div>
                      <div className="num" style={{
                        fontSize: 12, fontFamily: 'var(--font-mono)',
                        color: 'var(--ink-3)', minWidth: 40,
                      }}>
                        {t.actual_participants}/{t.max_participants}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <button
                      onClick={() => setScheduling(t)}
                      className="btn primary sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Plus size={12} strokeWidth={2.5} /> Programmer
                    </button>
                    <button onClick={() => onEditTemplate(t)} style={iconBtn} title="Modifier">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(t)} style={{ ...iconBtn, color: 'var(--danger)' }} title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {scheduling && (
          <ScheduleTemplateModal
            template={scheduling}
            onSchedule={schedule}
            onClose={() => setScheduling(null)}
          />
        )}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
  color: 'var(--ink-3)',
};
