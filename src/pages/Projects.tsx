import { useState, useRef, useEffect } from 'react';
import { useToastStore } from '@/stores/toastStore';
import {
  Plus, LayoutGrid, List, X, ChevronRight, Trash2,
  Calendar, User, AlertCircle, CheckCircle2, Clock,
  ArrowUpDown, ChevronUp, ChevronDown, Pencil, Check,
} from 'lucide-react';
import { useProjectsData } from './projects/useProjectsData';
import type { Project, Action, ProjectStatus, ActionStatus } from './projects/useProjectsData';

// ─── Constants ────────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'list';
type SortField = 'title' | 'owner_role' | 'status' | 'due_date' | 'progress';
type SortDir = 'asc' | 'desc';

const STATUS_COLUMNS: { key: ProjectStatus; label: string; color: string; bg: string; light: string }[] = [
  { key: 'todo',        label: 'À faire',   color: '#64748B', bg: '#F1F5F9', light: 'rgba(100,116,139,0.08)' },
  { key: 'in_progress', label: 'En cours',  color: '#1E40AF', bg: '#EFF6FF', light: 'rgba(30,64,175,0.07)'   },
  { key: 'done',        label: 'Terminé',   color: '#059669', bg: '#ECFDF5', light: 'rgba(5,150,105,0.07)'   },
  { key: 'overdue',     label: 'En retard', color: '#DC2626', bg: '#FEF2F2', light: 'rgba(220,38,38,0.07)'   },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function progressColor(pct: number): string {
  if (pct >= 70) return '#059669';
  if (pct >= 30) return '#D97706';
  return '#DC2626';
}

function computeProgress(actions: Action[]): number {
  if (actions.length === 0) return 0;
  return Math.round(actions.reduce((sum, a) => sum + a.progress, 0) / actions.length);
}

function statusMeta(status: ProjectStatus) {
  return STATUS_COLUMNS.find(c => c.key === status) ?? STATUS_COLUMNS[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = statusMeta(status);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: meta.bg,
      color: meta.color,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {status === 'done' && <CheckCircle2 size={10} />}
      {status === 'overdue' && <AlertCircle size={10} />}
      {status === 'in_progress' && <Clock size={10} />}
      {meta.label}
    </span>
  );
}


function ProgressBar({ value, height = 4 }: { value: number; height?: number }) {
  const color = progressColor(value);
  return (
    <div style={{
      height: `${height}px`,
      borderRadius: `${height}px`,
      background: '#E2E8F0',
      overflow: 'hidden',
      flex: 1,
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, Math.max(0, value))}%`,
        borderRadius: `${height}px`,
        background: color,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

// ─── Project Card (Kanban) ────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
  actionsCount: number;
  progress: number;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function ProjectCard({ project, actionsCount, progress, onSelect, onDragStart }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const meta = statusMeta(project.status);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-surface)',
        borderRadius: '8px',
        boxShadow: hovered
          ? '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.06)',
        borderLeft: `3px solid ${meta.color}`,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        userSelect: 'none',
      }}
    >
      {/* Title */}
      <p style={{
        margin: '0 0 8px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.35,
      }}>
        {project.title}
      </p>

      {/* Owner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginBottom: '10px',
      }}>
        <User size={11} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <span style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.owner_role}
        </span>
      </div>

      {/* Progress bar */}
      {actionsCount > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
              {actionsCount} action{actionsCount > 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: progressColor(progress), fontFamily: 'var(--font-sans)' }}>
              {progress}%
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      {/* Due date */}
      {project.due_date && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <Calendar size={10} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <span style={{
            fontSize: '11px',
            color: project.status === 'overdue' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-sans)',
          }}>
            {formatDate(project.due_date)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: typeof STATUS_COLUMNS[number];
  projects: Project[];
  progressMap: Record<number, number>;
  actionsCountMap: Record<number, number>;
  onSelectProject: (p: Project) => void;
  onDragStart: (e: React.DragEvent, projectId: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetStatus: ProjectStatus) => void;
  isDragOver: boolean;
}

function KanbanColumn({
  column, projects, progressMap, actionsCountMap,
  onSelectProject, onDragStart, onDragOver, onDrop, isDragOver,
}: KanbanColumnProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.key)}
      style={{
        flex: '1 1 0',
        minWidth: '220px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'background 0.15s ease',
        background: isDragOver ? column.light : 'transparent',
        borderRadius: '10px',
        padding: '4px',
      }}
    >
      {/* Column header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 4px 4px',
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: column.color,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: column.color,
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          {column.label}
        </span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '20px',
          height: '20px',
          borderRadius: '10px',
          background: column.bg,
          color: column.color,
          fontSize: '11px',
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          padding: '0 5px',
        }}>
          {projects.length}
        </span>
      </div>

      {/* Drop zone visual cue */}
      <div style={{
        border: isDragOver ? `2px dashed ${column.color}` : '2px dashed transparent',
        borderRadius: '8px',
        minHeight: isDragOver && projects.length === 0 ? '80px' : 0,
        transition: 'all 0.15s ease',
      }} />

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            actionsCount={actionsCountMap[project.id] ?? 0}
            progress={progressMap[project.id] ?? 0}
            onSelect={() => onSelectProject(project)}
            onDragStart={(e) => onDragStart(e, project.id)}
          />
        ))}
      </div>

      {projects.length === 0 && !isDragOver && (
        <div style={{
          padding: '20px 12px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '12px',
          fontFamily: 'var(--font-sans)',
          fontStyle: 'italic',
          opacity: 0.6,
        }}>
          Aucun projet
        </div>
      )}
    </div>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (data: Omit<Project, 'id' | 'created_at'>) => Promise<void>;
}

function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [ownerRole, setOwner]     = useState('');
  const [startDate, setStart]     = useState('');
  const [dueDate, setDue]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Le titre est requis.'); return; }
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        owner_role: ownerRole.trim(),
        status: 'todo',
        start_date: startDate || null,
        due_date: dueDate || null,
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        width: '100%',
        maxWidth: '500px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            Nouveau projet
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              padding: '4px', borderRadius: '4px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid #DC2626',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Titre *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nom du projet"
              autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Description du projet..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Responsable</label>
            <input
              value={ownerRole}
              onChange={e => setOwner(e.target.value)}
              placeholder="Rôle du responsable"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Date de début</label>
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Date d'échéance</label>
              <input type="date" value={dueDate} onChange={e => setDue(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Annuler
            </button>
            <button type="submit" disabled={saving} style={primaryBtnStyle}>
              {saving ? 'Création...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Project Detail Panel ─────────────────────────────────────────────────────

interface DetailPanelProps {
  project: Project;
  actions: Action[];
  actionsLoading: boolean;
  onClose: () => void;
  onUpdateProject: (id: number, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
  onCreateAction: (data: Omit<Action, 'id' | 'created_at'>) => Promise<void>;
  onUpdateAction: (id: number, updates: Partial<Action>) => Promise<void>;
  onDeleteAction: (id: number) => Promise<void>;
}

function DetailPanel({
  project, actions, actionsLoading,
  onClose, onUpdateProject, onDeleteProject,
  onCreateAction, onUpdateAction, onDeleteAction,
}: DetailPanelProps) {
  // Editable fields
  const [editTitle, setEditTitle]       = useState(project.title);
  const [editDesc, setEditDesc]         = useState(project.description);
  const [editOwner, setEditOwner]       = useState(project.owner_role);
  const [editStatus, setEditStatus]     = useState<ProjectStatus>(project.status);
  const [editDue, setEditDue]           = useState(project.due_date ?? '');
  const [editStart, setEditStart]       = useState(project.start_date ?? '');
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // New action
  const [newActionTitle, setNewActionTitle] = useState('');
  const [addingAction, setAddingAction]     = useState(false);
  const [newActionDue, setNewActionDue]     = useState('');

  // Inline editing action
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [editActionTitle, setEditActionTitle] = useState('');

  const overallProgress = computeProgress(actions);
  const meta = statusMeta(editStatus);

  async function saveProject() {
    setSaving(true);
    try {
      await onUpdateProject(project.id, {
        title: editTitle.trim() || project.title,
        description: editDesc.trim(),
        owner_role: editOwner.trim(),
        status: editStatus,
        start_date: editStart || null,
        due_date: editDue || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject() {
    setDeletingProject(true);
    try {
      await onDeleteProject(project.id);
    } finally {
      setDeletingProject(false);
    }
  }

  async function handleAddAction() {
    if (!newActionTitle.trim()) return;
    setAddingAction(true);
    try {
      await onCreateAction({
        project_id: project.id,
        title: newActionTitle.trim(),
        progress: 0,
        due_date: newActionDue || null,
        status: 'todo',
      });
      setNewActionTitle('');
      setNewActionDue('');
    } finally {
      setAddingAction(false);
    }
  }

  function startEditAction(action: Action) {
    setEditingActionId(action.id);
    setEditActionTitle(action.title);
  }

  async function saveActionTitle(id: number) {
    if (editActionTitle.trim()) {
      await onUpdateAction(id, { title: editActionTitle.trim() });
    }
    setEditingActionId(null);
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0, bottom: 0,
      width: '480px',
      maxWidth: '100vw',
      background: 'var(--color-surface)',
      boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '4px',
          height: '40px',
          borderRadius: '2px',
          background: meta.color,
          flexShrink: 0,
          marginTop: '2px',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={saveProject}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              padding: 0,
              lineHeight: 1.3,
            }}
          />
          <div style={{ marginTop: '6px' }}>
            <StatusBadge status={editStatus} />
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', padding: '4px',
          borderRadius: '4px', display: 'flex', alignItems: 'center',
          flexShrink: 0,
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Overall progress */}
        {actions.length > 0 && (
          <div style={{
            padding: '14px 16px',
            background: 'var(--color-bg)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                Progression globale
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: progressColor(overallProgress), fontFamily: 'var(--font-sans)' }}>
                {overallProgress}%
              </span>
            </div>
            <ProgressBar value={overallProgress} height={6} />
          </div>
        )}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Status select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Statut</label>
            <select
              value={editStatus}
              onChange={e => { setEditStatus(e.target.value as ProjectStatus); }}
              onBlur={saveProject}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {STATUS_COLUMNS.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onBlur={saveProject}
              placeholder="Description du projet..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Owner */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={labelStyle}>Responsable</label>
            <input
              value={editOwner}
              onChange={e => setEditOwner(e.target.value)}
              onBlur={saveProject}
              placeholder="Rôle du responsable"
              style={inputStyle}
            />
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>Date de début</label>
              <input
                type="date"
                value={editStart}
                onChange={e => setEditStart(e.target.value)}
                onBlur={saveProject}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>Échéance</label>
              <input
                type="date"
                value={editDue}
                onChange={e => setEditDue(e.target.value)}
                onBlur={saveProject}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Save notice */}
        {saving && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', margin: 0, fontStyle: 'italic' }}>
            Enregistrement...
          </p>
        )}

        {/* ── Actions section ── */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}>
              Actions ({actions.length})
            </h3>
          </div>

          {actionsLoading ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>
              Chargement...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actions.map(action => (
                <ActionRow
                  key={action.id}
                  action={action}
                  isEditing={editingActionId === action.id}
                  editTitle={editActionTitle}
                  onEditTitleChange={setEditActionTitle}
                  onStartEdit={() => startEditAction(action)}
                  onSaveTitle={() => saveActionTitle(action.id)}
                  onUpdateProgress={(v) => onUpdateAction(action.id, { progress: v, status: v === 100 ? 'done' : v > 0 ? 'in_progress' : 'todo' })}
                  onUpdateStatus={(s) => onUpdateAction(action.id, { status: s })}
                  onUpdateDueDate={(d) => onUpdateAction(action.id, { due_date: d })}
                  onDelete={() => onDeleteAction(action.id)}
                />
              ))}

              {/* Add action form */}
              <div style={{
                background: 'var(--color-bg)',
                borderRadius: '8px',
                border: '1px dashed var(--color-border)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <input
                  value={newActionTitle}
                  onChange={e => setNewActionTitle(e.target.value)}
                  placeholder="Titre de la nouvelle action..."
                  onKeyDown={e => e.key === 'Enter' && handleAddAction()}
                  style={{ ...inputStyle, fontSize: '13px' }}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={newActionDue}
                    onChange={e => setNewActionDue(e.target.value)}
                    style={{ ...inputStyle, fontSize: '12px', flex: 1 }}
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={addingAction || !newActionTitle.trim()}
                    style={{
                      ...primaryBtnStyle,
                      padding: '6px 12px',
                      fontSize: '12px',
                      flexShrink: 0,
                      opacity: !newActionTitle.trim() ? 0.5 : 1,
                    }}
                  >
                    <Plus size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    {addingAction ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Delete project ── */}
        <div style={{
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border)',
          marginTop: '8px',
        }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(220,38,38,0.04)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.15s',
              }}
            >
              <Trash2 size={14} />
              Supprimer le projet
            </button>
          ) : (
            <div style={{
              padding: '14px',
              background: 'rgba(220,38,38,0.05)',
              border: '1px solid rgba(220,38,38,0.25)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                Confirmer la suppression ? Cette action est irréversible.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setConfirmDelete(false)} style={{ ...secondaryBtnStyle, flex: 1, justifyContent: 'center' }}>
                  Annuler
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={deletingProject}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    background: '#DC2626',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  {deletingProject ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action Row ───────────────────────────────────────────────────────────────

interface ActionRowProps {
  action: Action;
  isEditing: boolean;
  editTitle: string;
  onEditTitleChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveTitle: () => void;
  onUpdateProgress: (v: number) => Promise<void>;
  onUpdateStatus: (s: ActionStatus) => Promise<void>;
  onUpdateDueDate: (d: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
}

function ActionRow({
  action, isEditing, editTitle, onEditTitleChange,
  onStartEdit, onSaveTitle,
  onUpdateProgress, onUpdateStatus, onUpdateDueDate, onDelete,
}: ActionRowProps) {
  const [hovered, setHovered] = useState(false);
  const [localProgress, setLocalProgress] = useState(action.progress);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleProgressChange(v: number) {
    setLocalProgress(v);
    if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = setTimeout(() => {
      onUpdateProgress(v);
    }, 400);
  }

  const pColor = progressColor(localProgress);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--color-bg)' : 'transparent',
        border: '1px solid',
        borderColor: hovered ? 'var(--color-border)' : 'transparent',
        borderRadius: '8px',
        padding: '10px 12px',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: `2px solid ${pColor}`,
          background: localProgress === 100 ? pColor : 'transparent',
          flexShrink: 0,
          marginTop: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {localProgress === 100 && <Check size={8} color="#fff" strokeWidth={3} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <input
              value={editTitle}
              onChange={e => onEditTitleChange(e.target.value)}
              onBlur={onSaveTitle}
              onKeyDown={e => { if (e.key === 'Enter') onSaveTitle(); }}
              autoFocus
              style={{
                ...inputStyle,
                fontSize: '13px',
                padding: '2px 6px',
                fontWeight: 500,
              }}
            />
          ) : (
            <span
              onClick={onStartEdit}
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: localProgress === 100 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                textDecoration: localProgress === 100 ? 'line-through' : 'none',
                cursor: 'text',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {action.title}
              {hovered && <Pencil size={10} style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }} />}
            </span>
          )}
          <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="date"
              value={action.due_date ?? ''}
              onChange={e => onUpdateDueDate(e.target.value || null)}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-secondary)',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: '4px',
                padding: '1px 4px',
                cursor: 'pointer',
                outline: 'none',
                colorScheme: 'light',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; }}
            />
            {action.due_date && hovered && (
              <button
                onClick={() => onUpdateDueDate(null)}
                title="Retirer la date"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-secondary)', opacity: 0.6,
                  padding: '0', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Status + delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <select
            value={action.status}
            onChange={e => onUpdateStatus(e.target.value as ActionStatus)}
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              padding: '2px 4px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="todo">À faire</option>
            <option value="in_progress">En cours</option>
            <option value="done">Terminé</option>
          </select>
          {hovered && (
            <button
              onClick={onDelete}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#DC2626', opacity: 0.7, padding: '2px',
                display: 'flex', alignItems: 'center', borderRadius: '3px',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Progress slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={localProgress}
          onChange={e => handleProgressChange(Number(e.target.value))}
          style={{
            flex: 1,
            height: '4px',
            accentColor: pColor,
            cursor: 'pointer',
          }}
        />
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: pColor,
          fontFamily: 'var(--font-sans)',
          minWidth: '30px',
          textAlign: 'right',
        }}>
          {localProgress}%
        </span>
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

interface ListViewProps {
  projects: Project[];
  progressMap: Record<number, number>;
  actionsCountMap: Record<number, number>;
  onSelectProject: (p: Project) => void;
}

function ListView({ projects, progressMap, actionsCountMap, onSelectProject }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sorted = [...projects].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    switch (sortField) {
      case 'title':      av = a.title;      bv = b.title;      break;
      case 'owner_role': av = a.owner_role; bv = b.owner_role; break;
      case 'status':     av = a.status;     bv = b.status;     break;
      case 'due_date':   av = a.due_date ?? '9999'; bv = b.due_date ?? '9999'; break;
      case 'progress':   av = progressMap[a.id] ?? 0; bv = progressMap[b.id] ?? 0; break;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: '4px' }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: '4px', color: 'var(--color-primary)' }} />
      : <ChevronDown size={12} style={{ marginLeft: '4px', color: 'var(--color-primary)' }} />;
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: 'var(--color-bg)',
    borderBottom: '1px solid var(--color-border)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: '10px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      border: '1px solid var(--color-border)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle} onClick={() => handleSort('title')}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Titre <SortIcon field="title" /></span>
            </th>
            <th style={thStyle} onClick={() => handleSort('owner_role')}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Responsable <SortIcon field="owner_role" /></span>
            </th>
            <th style={thStyle} onClick={() => handleSort('status')}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Statut <SortIcon field="status" /></span>
            </th>
            <th style={thStyle} onClick={() => handleSort('due_date')}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Échéance <SortIcon field="due_date" /></span>
            </th>
            <th style={thStyle} onClick={() => handleSort('progress')}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Actions / Progression <SortIcon field="progress" /></span>
            </th>
            <th style={{ ...thStyle, cursor: 'default' }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((project, i) => {
            const progress = progressMap[project.id] ?? 0;
            const count    = actionsCountMap[project.id] ?? 0;
            return (
              <ListRow
                key={project.id}
                project={project}
                progress={progress}
                actionsCount={count}
                isEven={i % 2 === 0}
                onSelect={() => onSelectProject(project)}
              />
            );
          })}
        </tbody>
      </table>

      {projects.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
        }}>
          Aucun projet pour le moment.
        </div>
      )}
    </div>
  );
}

function ListRow({ project, progress, actionsCount, isEven, onSelect }: {
  project: Project; progress: number; actionsCount: number;
  isEven: boolean; onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
    background: hovered ? 'rgba(30,64,175,0.03)' : isEven ? 'transparent' : 'rgba(248,247,244,0.5)',
    cursor: 'pointer',
    transition: 'background 0.1s ease',
  };

  return (
    <tr
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ ...tdStyle, fontWeight: 600, maxWidth: '220px' }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title}
        </span>
      </td>
      <td style={{ ...tdStyle, color: 'var(--color-text-secondary)', maxWidth: '160px' }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.owner_role || '—'}
        </span>
      </td>
      <td style={tdStyle}>
        <StatusBadge status={project.status} />
      </td>
      <td style={{ ...tdStyle, color: project.status === 'overdue' ? '#DC2626' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {formatDate(project.due_date)}
      </td>
      <td style={{ ...tdStyle, minWidth: '160px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              {actionsCount} action{actionsCount > 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: progressColor(progress) }}>
              {progress}%
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>
      </td>
      <td style={{ ...tdStyle, width: '32px', paddingLeft: '4px' }}>
        <ChevronRight size={14} style={{ color: 'var(--color-border)' }} />
      </td>
    </tr>
  );
}

// ─── Shared style constants ───────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-sans)',
  letterSpacing: '0.03em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  fontSize: '14px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--color-primary)',
  border: 'none',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function Projects() {
  const {
    projects, loading, error, usingMock,
    selectedProject, selectedActions, actionsLoading,
    selectProject, refreshProjects,
    createProject, updateProject, deleteProject,
    createAction, updateAction, deleteAction,
  } = useProjectsData();

  const addToast = useToastStore((s) => s.add);
  const [viewMode, setViewMode]     = useState<ViewMode>('kanban');
  const [showCreate, setShowCreate] = useState(false);

  // Drag & drop state
  const dragProjectId = useRef<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  // Persist action counts & progress per project as they are loaded,
  // so cards show data even after the detail panel closes.
  const [actionMeta, setActionMeta] = useState<Record<number, { count: number; progress: number }>>({});

  useEffect(() => {
    if (selectedProject && selectedActions.length > 0) {
      const progress = computeProgress(selectedActions);
      setActionMeta(prev => ({
        ...prev,
        [selectedProject.id]: { count: selectedActions.length, progress },
      }));
    }
  }, [selectedProject, selectedActions]);

  const progressMap: Record<number, number>    = {};
  const actionsCountMap: Record<number, number> = {};
  for (const [idStr, meta] of Object.entries(actionMeta)) {
    const id = Number(idStr);
    progressMap[id]     = meta.progress;
    actionsCountMap[id] = meta.count;
  }

  function handleSelectProject(project: Project) {
    selectProject(project);
  }

  function handleCloseDetail() {
    selectProject(null);
  }

  // Drag & drop handlers
  function handleDragStart(e: React.DragEvent, projectId: number) {
    dragProjectId.current = projectId;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, status: ProjectStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function handleDrop(e: React.DragEvent, targetStatus: ProjectStatus) {
    e.preventDefault();
    setDragOverStatus(null);
    const id = dragProjectId.current;
    if (id === null) return;
    const project = projects.find(p => p.id === id);
    if (!project || project.status === targetStatus) return;
    updateProject(id, { status: targetStatus });
    dragProjectId.current = null;
  }

  function handleDragEnd() {
    setDragOverStatus(null);
    dragProjectId.current = null;
  }

  // Group projects by status for kanban
  const byStatus: Record<ProjectStatus, Project[]> = {
    todo: [], in_progress: [], done: [], overdue: [],
  };
  for (const p of projects) {
    byStatus[p.status].push(p);
  }

  // ── Skeleton loader ──
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>
        <div>
          <div style={{ width: '160px', height: '28px', borderRadius: '6px', background: 'var(--color-border)', marginBottom: '8px' }} className="shimmer" />
          <div style={{ width: '260px', height: '16px', borderRadius: '4px', background: 'var(--color-border)' }} className="shimmer" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: '200px', borderRadius: '8px', background: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} className="shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop overlay for detail panel */}
      {selectedProject && (
        <div
          onClick={handleCloseDetail}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            background: 'rgba(15,23,42,0.2)',
            backdropFilter: 'blur(1px)',
          }}
        />
      )}

      {/* Create project modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            await createProject(data);
            await refreshProjects();
            addToast('Projet créé', 'success');
          }}
        />
      )}

      {/* Detail panel */}
      {selectedProject && (
        <DetailPanel
          project={selectedProject}
          actions={selectedActions}
          actionsLoading={actionsLoading}
          onClose={handleCloseDetail}
          onUpdateProject={updateProject}
          onDeleteProject={async (id: number) => {
            await deleteProject(id);
            addToast('Projet supprimé', 'success');
          }}
          onCreateAction={createAction}
          onUpdateAction={updateAction}
          onDeleteAction={deleteAction}
        />
      )}

      <div
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '1400px',
        }}
      >
        {/* ── A. Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 1.2,
            }}>
              Projets
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: '4px 0 0',
              fontFamily: 'var(--font-sans)',
            }}>
              Gestion des projets d'établissement
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View toggle */}
            <div style={{
              display: 'flex',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setViewMode('kanban')}
                title="Vue Kanban"
                style={{
                  padding: '7px 10px',
                  background: viewMode === 'kanban' ? 'var(--color-primary)' : 'var(--color-surface)',
                  border: 'none',
                  cursor: 'pointer',
                  color: viewMode === 'kanban' ? '#fff' : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Vue Liste"
                style={{
                  padding: '7px 10px',
                  background: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-surface)',
                  border: 'none',
                  borderLeft: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  color: viewMode === 'list' ? '#fff' : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <List size={15} />
              </button>
            </div>

            {/* New project button */}
            <button
              onClick={() => setShowCreate(true)}
              style={primaryBtnStyle}
            >
              <Plus size={15} />
              Nouveau projet
            </button>
          </div>
        </div>

        {/* Error / mock notice */}
        {(error || usingMock) && (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(217,119,6,0.06)',
            border: '1px solid var(--color-warning)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-warning)',
            fontFamily: 'var(--font-sans)',
          }}>
            Données de démonstration — la base de données n'est pas accessible.
          </div>
        )}

        {/* ── B/C. Kanban or List view ── */}
        {viewMode === 'kanban' ? (
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}>
            {STATUS_COLUMNS.map(column => (
              <KanbanColumn
                key={column.key}
                column={column}
                projects={byStatus[column.key]}
                progressMap={progressMap}
                actionsCountMap={actionsCountMap}
                onSelectProject={handleSelectProject}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, column.key)}
                onDrop={handleDrop}
                isDragOver={dragOverStatus === column.key}
              />
            ))}
          </div>
        ) : (
          <ListView
            projects={projects}
            progressMap={progressMap}
            actionsCountMap={actionsCountMap}
            onSelectProject={handleSelectProject}
          />
        )}
      </div>
    </>
  );
}
