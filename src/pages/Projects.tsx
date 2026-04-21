import { useState, useRef, useMemo } from 'react';
import {
  Plus, Search, Trash2, X, Pencil, Check, Clock, CheckCircle2,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useProjectsData } from './projects/useProjectsData';
import type { Project, Action, ProjectStatus, ActionStatus } from './projects/useProjectsData';

/* ─── Category palette (maps DB string → chip class) ─────────── */

const CATEGORY_CLASSES = ['memory', 'creative', 'body', 'outing', 'rdv', 'prep'] as const;
type CategoryClass = typeof CATEGORY_CLASSES[number];

const CATEGORY_LABELS: Record<CategoryClass, string> = {
  memory:   'Thérapeutique',
  creative: 'Événement',
  body:     'Jardin & vie',
  outing:   'Sortie',
  rdv:      'Accompagnement',
  prep:     'Général',
};

function normalizeCategory(raw: string): CategoryClass {
  if (!raw) return 'prep';
  const k = raw.toLowerCase().trim();
  if ((CATEGORY_CLASSES as readonly string[]).includes(k)) return k as CategoryClass;
  // Loose aliases
  if (k.includes('mémoire') || k.includes('memoire')) return 'memory';
  if (k.includes('événement') || k.includes('event') || k.includes('fête') || k.includes('fete')) return 'creative';
  if (k.includes('jardin') || k.includes('vie')) return 'body';
  if (k.includes('sortie')) return 'outing';
  if (k.includes('accompagnement') || k.includes('rdv') || k.includes('rendez')) return 'rdv';
  // Hash fallback for stable coloring on arbitrary custom categories
  let h = 0;
  for (let i = 0; i < k.length; i++) h = ((h << 5) - h + k.charCodeAt(i)) | 0;
  return CATEGORY_CLASSES[Math.abs(h) % CATEGORY_CLASSES.length];
}

function categoryLabel(raw: string): string {
  if (!raw.trim()) return CATEGORY_LABELS.prep;
  // If the DB stored a human-readable label already, keep it. Otherwise use our
  // canonical label for the normalized class.
  const cls = normalizeCategory(raw);
  // If the raw value contains spaces or diacritics, assume it's already a label.
  if (/[ éèêàâùîôç/]/.test(raw)) return raw;
  return CATEGORY_LABELS[cls];
}

/* ─── Status meta ────────────────────────────────────────────── */

const STATUS_CHIP: Record<ProjectStatus, { label: string; cls: string; icon?: typeof Clock }> = {
  todo:        { label: 'à démarrer', cls: 'ghost' },
  in_progress: { label: 'en cours',   cls: 'info',   icon: Clock },
  done:        { label: 'terminé',    cls: 'done',   icon: CheckCircle2 },
  overdue:     { label: 'en retard',  cls: 'warn' },
};

type StatusFilter = 'all' | 'in_progress' | 'todo' | 'done';

/* ─── Helpers ────────────────────────────────────────────────── */

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function formatDeadline(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

function projectProgress(actions: Action[]): number {
  if (actions.length === 0) return 0;
  return Math.round(actions.reduce((sum, a) => sum + a.progress, 0) / actions.length);
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function Projects() {
  const {
    projects, loading,
    selectedProject, selectedActions,
    selectProject,
    createProject, updateProject, deleteProject,
    createAction, updateAction, deleteAction,
  } = useProjectsData();

  const addToast = useToastStore((s) => s.add);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);

  // Auto-select first project on load (and whenever list changes if no sel)
  if (!loading && !selectedProject && projects[0]) selectProject(projects[0]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q)
          || p.description.toLowerCase().includes(q)
          || p.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [projects, filter, search]);

  // Inline action progress per project (use selected's actions; list shows static pct from status)
  const progressByProjectId = useMemo(() => {
    const map = new Map<number, number>();
    if (selectedProject) map.set(selectedProject.id, projectProgress(selectedActions));
    return map;
  }, [selectedProject, selectedActions]);

  const editingProject = editProjectId
    ? projects.find((p) => p.id === editProjectId) ?? null
    : null;

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce projet ? Les étapes associées seront perdues.')) return;
    try {
      await deleteProject(id);
      addToast('Projet supprimé', 'success');
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    }
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) 1fr', gap: 20,
      maxWidth: 1400, height: 'calc(100vh - 130px)',
      animation: 'slide-in 0.22s ease-out',
    }}>
      {/* ─── List (master) ─── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px',
          }}>
            <Search size={14} style={{ color: 'var(--ink-3)' }} />
            <input
              type="text" placeholder="Chercher un projet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: 'var(--ink)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {([
              ['all', 'tous'],
              ['in_progress', 'en cours'],
              ['todo', 'à démarrer'],
              ['done', 'terminés'],
            ] as Array<[StatusFilter, string]>).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`chip ${filter === k ? 'creative' : 'ghost'}`}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 28, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
              Aucun projet
            </div>
          ) : (
            filtered.map((p) => {
              const active = p.id === selectedProject?.id;
              const cls = normalizeCategory(p.category);
              const pct = progressByProjectId.get(p.id) ?? (p.status === 'done' ? 100 : 0);
              const statusMeta = STATUS_CHIP[p.status];
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '14px 16px',
                    background: active ? 'var(--cat-creative-bg)' : 'transparent',
                    borderBottom: '1px solid var(--line)',
                    borderLeft: `3px solid ${active ? 'var(--cat-creative)' : 'transparent'}`,
                    border: `none`, borderBottomColor: 'var(--line)',
                    borderLeftWidth: 3,
                    borderLeftStyle: 'solid',
                    borderLeftColor: active ? 'var(--cat-creative)' : 'transparent',
                    borderBottomStyle: 'solid',
                    borderBottomWidth: 1,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`chip ${cls}`} style={{ fontSize: 10.5 }}>
                      {categoryLabel(p.category)}
                    </span>
                    <div style={{ flex: 1 }} />
                    {p.status === 'done' && (
                      <span className="chip done no-dot" style={{ fontSize: 10 }}>
                        <Check size={10} strokeWidth={2.5} /> terminé
                      </span>
                    )}
                    {p.status === 'todo' && (
                      <span className="chip ghost" style={{ fontSize: 10.5 }}>à démarrer</span>
                    )}
                    {p.status === 'overdue' && (
                      <span className="chip warn no-dot" style={{ fontSize: 10 }}>en retard</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: -0.1, color: 'var(--ink)' }}>
                    {p.title}
                  </div>
                  <div className="num" style={{
                    fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {formatDeadline(p.due_date)}
                  </div>
                  {p.status === 'in_progress' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <div style={{
                        flex: 1, height: 4, background: 'var(--surface-2)',
                        borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: `var(--cat-${cls})`,
                        }} />
                      </div>
                      <div className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {pct}%
                      </div>
                    </div>
                  )}
                  {/* Suppress the line above when statusMeta could be useful */}
                  {statusMeta && null}
                </button>
              );
            })
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setEditProjectId(null); setShowForm(true); }}
          >
            <Plus size={14} /> Nouveau projet
          </button>
        </div>
      </div>

      {/* ─── Detail ─── */}
      {selectedProject ? (
        <ProjectDetail
          project={selectedProject}
          actions={selectedActions}
          onEdit={() => { setEditProjectId(selectedProject.id); setShowForm(true); }}
          onDelete={() => handleDelete(selectedProject.id)}
          onUpdateProject={updateProject}
          onCreateAction={createAction}
          onUpdateAction={updateAction}
          onDeleteAction={deleteAction}
        />
      ) : (
        <div className="card" style={{
          padding: 60, display: 'grid', placeItems: 'center',
          color: 'var(--ink-3)', fontSize: 14,
        }}>
          {projects.length === 0
            ? 'Aucun projet — créez le premier avec « Nouveau projet ».'
            : 'Sélectionnez un projet dans la liste.'}
        </div>
      )}

      {/* ─── Project form modal ─── */}
      {showForm && (
        <ProjectFormModal
          initial={editingProject}
          onCancel={() => { setShowForm(false); setEditProjectId(null); }}
          onSubmit={async (data) => {
            try {
              if (editingProject) {
                await updateProject(editingProject.id, data);
                addToast('Projet mis à jour', 'success');
              } else {
                await createProject(data);
                addToast('Projet créé', 'success');
              }
              setShowForm(false);
              setEditProjectId(null);
            } catch {
              addToast("Erreur lors de l'enregistrement", 'error');
            }
          }}
        />
      )}
    </div>
  );
}

/* ─── Detail panel ───────────────────────────────────────────── */

interface ProjectDetailProps {
  project: Project;
  actions: Action[];
  onEdit: () => void;
  onDelete: () => void;
  onUpdateProject: (id: number, updates: Partial<Project>) => Promise<void>;
  onCreateAction: (data: Omit<Action, 'id' | 'created_at'>) => Promise<void>;
  onUpdateAction: (id: number, updates: Partial<Action>) => Promise<void>;
  onDeleteAction: (id: number) => Promise<void>;
}

function ProjectDetail({
  project: p, actions, onEdit, onDelete,
  onUpdateProject, onCreateAction, onUpdateAction, onDeleteAction,
}: ProjectDetailProps) {
  const cls = normalizeCategory(p.category);
  const status = STATUS_CHIP[p.status];
  const pct = projectProgress(actions);
  const doneCount = actions.filter((a) => a.status === 'done').length;

  const [newStep, setNewStep] = useState('');

  async function toggleAction(a: Action) {
    const nextStatus: ActionStatus = a.status === 'done' ? 'todo' : 'done';
    await onUpdateAction(a.id, {
      status: nextStatus,
      progress: nextStatus === 'done' ? 100 : 0,
    });
  }

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    const title = newStep.trim();
    if (!title) return;
    await onCreateAction({
      project_id: p.id,
      title,
      progress: 0,
      status: 'todo',
      due_date: null,
    });
    setNewStep('');
  }

  const team = (p.owner_role || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="card" style={{ padding: 32, overflow: 'auto' }}>
      {/* Top chips row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span className={`chip ${cls}`}>{categoryLabel(p.category)}</span>
        <span className={`chip ${status.cls}${status.icon ? ' no-dot' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {status.icon && <status.icon size={10} />}
          {status.label}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn sm" onClick={onEdit}>
          <Pencil size={12} /> Modifier
        </button>
        <button className="btn sm" onClick={onDelete} style={{ color: 'var(--danger)' }} title="Supprimer">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Title + description */}
      <h2 className="serif" style={{
        fontSize: 36, fontWeight: 500, letterSpacing: -1,
        margin: '0 0 6px', lineHeight: 1.05,
      }}>
        {p.title}
      </h2>
      {p.description && (
        <div style={{
          fontSize: 14.5, color: 'var(--ink-3)', marginBottom: 22,
          lineHeight: 1.6, maxWidth: 640,
        }}>
          {p.description}
        </div>
      )}

      {/* 3 stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28,
      }}>
        <div className="card-soft" style={{ padding: 14 }}>
          <div className="eyebrow">Échéance</div>
          <div className="serif num" style={{ fontSize: 17, fontWeight: 500, marginTop: 2 }}>
            {formatDeadline(p.due_date)}
          </div>
        </div>
        <div className="card-soft" style={{ padding: 14 }}>
          <div className="eyebrow">Avancement</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <div className="serif num" style={{ fontSize: 22, fontWeight: 500 }}>
              {pct}<span style={{ fontSize: 13, color: 'var(--ink-3)' }}>%</span>
            </div>
            <div style={{
              flex: 1, height: 5, background: 'var(--surface)',
              borderRadius: 3, overflow: 'hidden', marginLeft: 8,
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: `var(--cat-${cls})`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>
        <div className="card-soft" style={{ padding: 14 }}>
          <div className="eyebrow">Équipe</div>
          {team.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 4 }}>
              Non renseignée
            </div>
          ) : (
            <div style={{ display: 'flex', marginTop: 6 }}>
              {team.map((t, i) => (
                <div
                  key={i}
                  title={t}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: i % 2 === 0 ? 'var(--sage-soft)' : 'var(--cat-memory-bg)',
                    color: i % 2 === 0 ? 'var(--sage-deep)' : 'var(--cat-memory)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 11, fontWeight: 600,
                    border: '2px solid var(--surface)',
                    marginLeft: i > 0 ? -6 : 0,
                  }}
                >
                  {initials(t)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Étapes */}
      {actions.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
            <div className="serif" style={{ fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
              Étapes
            </div>
            <div className="num" style={{ marginLeft: 10, fontSize: 12, color: 'var(--ink-3)' }}>
              {doneCount} / {actions.length}
            </div>
            <div style={{ flex: 1 }} />
          </div>
          <div className="card-soft" style={{ padding: '4px 16px' }}>
            {actions.map((a, i) => {
              const done = a.status === 'done';
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 0',
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <button
                    onClick={() => toggleAction(a)}
                    title={done ? 'Marquer à faire' : 'Marquer comme fait'}
                    style={{
                      width: 20, height: 20, borderRadius: 5,
                      background: done ? `var(--cat-${cls})` : 'var(--surface)',
                      border: `1.5px solid ${done ? `var(--cat-${cls})` : 'var(--line-strong)'}`,
                      display: 'grid', placeItems: 'center',
                      cursor: 'pointer', padding: 0, flexShrink: 0,
                    }}
                  >
                    {done && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
                  </button>
                  <div style={{
                    flex: 1, fontSize: 14,
                    color: done ? 'var(--ink-3)' : 'var(--ink)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {a.title}
                  </div>
                  <button
                    onClick={() => onDeleteAction(a.id)}
                    title="Supprimer l'étape"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ink-4)', padding: 4, display: 'flex',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            <form onSubmit={handleAddStep} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderTop: '1px solid var(--line)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                border: '1.5px dashed var(--line-strong)', flexShrink: 0,
              }} />
              <input
                type="text" placeholder="Nouvelle étape…"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                style={{
                  flex: 1, fontSize: 14, border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--ink)',
                }}
              />
              {newStep.trim() && (
                <button type="submit" className="btn sm primary">
                  <Plus size={11} /> Ajouter
                </button>
              )}
            </form>
          </div>
        </>
      ) : (
        <div style={{
          padding: '28px 24px', textAlign: 'center',
          background: 'var(--surface-2)', border: '1px dashed var(--line-strong)',
          borderRadius: 12, color: 'var(--ink-3)', fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, color: 'var(--ink-2)', fontSize: 14 }}>
            {p.status === 'done' ? 'Projet terminé' : 'Aucune étape'}
          </div>
          <div style={{ marginTop: 4 }}>
            {p.status === 'done'
              ? 'Entretien courant — plus d\'étapes à venir.'
              : 'Ajoutez une première étape ci-dessous.'}
          </div>
          {p.status !== 'done' && (
            <form onSubmit={handleAddStep} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 14, maxWidth: 320, marginInline: 'auto',
            }}>
              <input
                type="text" placeholder="Première étape…"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                style={{
                  flex: 1, padding: '6px 10px',
                  border: '1px solid var(--line)', borderRadius: 6,
                  fontSize: 13, background: 'var(--surface)',
                }}
              />
              <button type="submit" className="btn sm primary" disabled={!newStep.trim()}>
                <Plus size={11} /> Ajouter
              </button>
            </form>
          )}
        </div>
      )}

      {/* Prochaine action callout */}
      {p.next_action && p.status !== 'done' && (
        <div style={{
          marginTop: 20, padding: '14px 18px',
          background: 'var(--cat-creative-bg)', borderRadius: 10,
          borderLeft: '3px solid var(--cat-creative)',
        }}>
          <div className="eyebrow" style={{ color: 'var(--cat-creative)' }}>
            Prochaine action
          </div>
          <div style={{
            fontSize: 14, color: 'var(--ink)', marginTop: 2, fontWeight: 500,
          }}>
            {p.next_action}
          </div>
          <button
            onClick={() => onUpdateProject(p.id, { next_action: '' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', fontSize: 11, marginTop: 6, padding: 0,
            }}
          >
            Effacer
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Project form modal ─────────────────────────────────────── */

interface ProjectFormModalProps {
  initial: Project | null;
  onCancel: () => void;
  onSubmit: (data: Omit<Project, 'id' | 'created_at'>) => Promise<void>;
}

function ProjectFormModal({ initial, onCancel, onSubmit }: ProjectFormModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<CategoryClass>(
    initial ? normalizeCategory(initial.category) : 'prep',
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const data: Omit<Project, 'id' | 'created_at'> = {
      title: (fd.get('title') as string).trim(),
      description: (fd.get('description') as string) ?? '',
      owner_role: (fd.get('owner_role') as string) ?? '',
      status: (fd.get('status') as ProjectStatus) ?? 'todo',
      start_date: (fd.get('start_date') as string) || null,
      due_date: (fd.get('due_date') as string) || null,
      category,
      next_action: (fd.get('next_action') as string) ?? '',
    };
    if (!data.title) return;
    await onSubmit(data);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(35, 29, 24, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          padding: 24, width: 580, maxHeight: '85vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>
            {initial ? 'Modifier le projet' : 'Nouveau projet'}
          </h2>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onCancel} style={{ padding: 6 }} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Titre" required>
            <input
              name="title" defaultValue={initial?.title ?? ''} required
              placeholder="Spectacle de Noël"
              style={inputStyle}
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description" rows={3} defaultValue={initial?.description ?? ''}
              placeholder="Un après-midi de chorale, saynètes et goûter…"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </Field>

          <Field label="Catégorie">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              {CATEGORY_CLASSES.map((k) => {
                const active = category === k;
                return (
                  <button
                    key={k} type="button"
                    onClick={() => setCategory(k)}
                    className={active ? `chip ${k}` : 'chip ghost'}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    {CATEGORY_LABELS[k]}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Statut">
              <select name="status" defaultValue={initial?.status ?? 'todo'} style={inputStyle}>
                <option value="todo">À démarrer</option>
                <option value="in_progress">En cours</option>
                <option value="done">Terminé</option>
                <option value="overdue">En retard</option>
              </select>
            </Field>
            <Field label="Échéance">
              <input
                name="due_date" type="date"
                defaultValue={initial?.due_date ?? ''} style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Équipe (noms séparés par une virgule)">
            <input
              name="owner_role" defaultValue={initial?.owner_role ?? ''}
              placeholder="Marie Coste, Sophie G."
              style={inputStyle}
            />
          </Field>

          <Field label="Prochaine action">
            <input
              name="next_action" defaultValue={initial?.next_action ?? ''}
              placeholder="Lundi : présenter le devis en réunion"
              style={inputStyle}
            />
          </Field>

          <button type="submit" className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }}>
            {initial ? 'Mettre à jour' : 'Créer le projet'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Form bits ──────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--line)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)',
  color: 'var(--ink)', outline: 'none',
};

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </div>
      {children}
    </label>
  );
}
