import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Plus, Search, FileText, ChevronDown, Trash2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Minus,
  Calendar, User, Tag, Loader2,
} from 'lucide-react';
import { useNotesData } from './notes/useNotesData';
import type { DocType, Document } from './notes/useNotesData';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_META: Record<DocType, { label: string; color: string; bg: string; border: string }> = {
  note_service:  { label: 'Note de service',  color: '#1E40AF', bg: '#EFF6FF',  border: '#BFDBFE' },
  cr_animation:  { label: 'CR Animation',     color: '#7C3AED', bg: '#F5F3FF',  border: '#DDD6FE' },
  cr_equipe:     { label: 'CR Équipe',         color: '#059669', bg: '#ECFDF5',  border: '#A7F3D0' },
  cr_reunion:    { label: 'CR Réunion',        color: '#D97706', bg: '#FFFBEB',  border: '#FDE68A' },
  cr_projet:     { label: 'CR Projet',         color: '#0F766E', bg: '#F0FDFA',  border: '#99F6E4' },
  other:         { label: 'Autre',             color: '#64748B', bg: '#F1F5F9',  border: '#CBD5E1' },
};

const DOC_TYPES: DocType[] = ['note_service', 'cr_animation', 'cr_equipe', 'cr_reunion', 'cr_projet', 'other'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

// ─── DocType Badge ────────────────────────────────────────────────────────────

function DocTypeBadge({ type }: { type: DocType }) {
  const meta = DOC_TYPE_META[type];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.03em',
      background: meta.bg,
      color: meta.color,
      border: `1px solid ${meta.border}`,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {meta.label}
    </span>
  );
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        borderRadius: '5px',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── Toolbar Divider ──────────────────────────────────────────────────────────

function ToolbarDivider() {
  return (
    <span style={{
      width: '1px',
      height: '18px',
      background: 'var(--color-border)',
      display: 'inline-block',
      margin: '0 4px',
      flexShrink: 0,
    }} />
  );
}

// ─── Editor Toolbar ───────────────────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '2px',
      padding: '6px 10px',
      borderBottom: '1px solid var(--color-border)',
      background: '#FAFAF9',
      borderRadius: '8px 8px 0 0',
    }}>
      {/* Text formatting */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Gras">
        <Bold size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italique">
        <Italic size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Souligné">
        <UnderlineIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Barré">
        <Strikethrough size={14} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Titre 1">
        <Heading1 size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Titre 2">
        <Heading2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Titre 3">
        <Heading3 size={14} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Liste à puces">
        <List size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Liste numérotée">
        <ListOrdered size={14} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Aligner à gauche">
        <AlignLeft size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrer">
        <AlignCenter size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Aligner à droite">
        <AlignRight size={14} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Horizontal rule */}
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Séparateur horizontal">
        <Minus size={14} />
      </ToolbarBtn>
    </div>
  );
}

// ─── Document List Item ───────────────────────────────────────────────────────

function DocListItem({
  doc,
  isActive,
  onClick,
}: {
  doc: Document;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        background: isActive ? 'var(--color-primary)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        borderRadius: 0,
      }}
    >
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        color: isActive ? '#fff' : 'var(--color-text-primary)',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {doc.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        {isActive ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
          }}>
            {DOC_TYPE_META[doc.doc_type].label}
          </span>
        ) : (
          <DocTypeBadge type={doc.doc_type} />
        )}
        <span style={{
          fontSize: '11px',
          color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {formatDate(doc.date)}
        </span>
      </div>
      {doc.author_role && (
        <div style={{
          fontSize: '11px',
          color: isActive ? 'rgba(255,255,255,0.65)' : 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <User size={10} />
          {doc.author_role}
        </div>
      )}
    </button>
  );
}

// ─── Template Dropdown ────────────────────────────────────────────────────────

function TemplateDropdown({
  templates,
  onSelectTemplate,
  onBlankDoc,
  onClose,
}: {
  templates: Document[];
  onSelectTemplate: (t: Document) => void;
  onBlankDoc: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        zIndex: 200,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        minWidth: '240px',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '8px 12px 4px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)',
      }}>
        Document vide
      </div>
      <button
        type="button"
        onClick={() => { onBlankDoc(); onClose(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '9px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <FileText size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        Nouveau document vide
      </button>

      <div style={{
        borderTop: '1px solid var(--color-border)',
        padding: '8px 12px 4px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)',
      }}>
        À partir d'un modèle
      </div>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => { onSelectTemplate(t); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '9px 14px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'left',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: DOC_TYPE_META[t.doc_type].color,
            flexShrink: 0,
          }} />
          {DOC_TYPE_META[t.doc_type].label}
        </button>
      ))}
      <div style={{ height: '4px' }} />
    </div>
  );
}

// ─── Editor Panel ─────────────────────────────────────────────────────────────

interface EditorPanelProps {
  doc: Document;
  onSave: (id: number, updates: Partial<Document>) => void;
  onDelete: (id: number) => void;
}

function EditorPanel({ doc, onSave, onDelete }: EditorPanelProps) {
  const [localTitle, setLocalTitle]       = useState(doc.title);
  const [localType, setLocalType]         = useState<DocType>(doc.doc_type);
  const [localRole, setLocalRole]         = useState(doc.author_role);
  const [localDate, setLocalDate]         = useState(doc.date);
  const [saving, setSaving]               = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local state when selected doc changes
  useEffect(() => {
    setLocalTitle(doc.title);
    setLocalType(doc.doc_type);
    setLocalRole(doc.author_role);
    setLocalDate(doc.date);
    setConfirmDelete(false);
  }, [doc.id]);

  // Debounced save
  const debouncedSave = useCallback(
    (updates: Partial<Document>) => {
      setSaving(true);
      onSave(doc.id, updates);
      setTimeout(() => setSaving(false), 600);
    },
    [doc.id, onSave]
  );

  const debouncedSaveFn = useDebounce(debouncedSave, 800);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Commencez à rédiger...' }),
    ],
    content: doc.content ?? '',
    onUpdate: ({ editor }) => {
      debouncedSaveFn({ content: editor.getHTML() });
    },
  });

  // Sync editor content when doc changes
  useEffect(() => {
    if (editor && editor.getHTML() !== doc.content) {
      editor.commands.setContent(doc.content ?? '');
    }
  }, [doc.id]);

  function handleTitleBlur() {
    if (localTitle !== doc.title) {
      debouncedSaveFn({ title: localTitle });
    }
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as DocType;
    setLocalType(v);
    onSave(doc.id, { doc_type: v });
  }

  function handleRoleBlur() {
    if (localRole !== doc.author_role) {
      onSave(doc.id, { author_role: localRole });
    }
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalDate(e.target.value);
    onSave(doc.id, { date: e.target.value });
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete(doc.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Editor header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {/* Title */}
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Titre du document"
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            background: 'transparent',
            marginBottom: '12px',
            lineHeight: 1.3,
          }}
        />

        {/* Metadata bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          {/* Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
            <select
              value={localType}
              onChange={handleTypeChange}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                color: DOC_TYPE_META[localType].color,
                background: DOC_TYPE_META[localType].bg,
                cursor: 'pointer',
                outline: 'none',
                fontWeight: 600,
              }}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{DOC_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>

          {/* Author role */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
            <input
              type="text"
              value={localRole}
              onChange={(e) => setLocalRole(e.target.value)}
              onBlur={handleRoleBlur}
              placeholder="Rôle de l'auteur"
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
                outline: 'none',
                width: '160px',
              }}
            />
          </div>

          {/* Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
            <input
              type="date"
              value={localDate}
              onChange={handleDateChange}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
                outline: 'none',
              }}
            />
          </div>

          {/* Spacer + saving indicator + delete */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saving && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Enregistrement…
              </span>
            )}
            <button
              type="button"
              onClick={handleDeleteClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: `1px solid ${confirmDelete ? '#DC2626' : 'var(--color-border)'}`,
                background: confirmDelete ? '#FEF2F2' : 'transparent',
                color: confirmDelete ? '#DC2626' : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Trash2 size={12} />
              {confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>

      {/* TipTap editor */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <EditorToolbar editor={editor} />
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
        }}>
          <style>{`
            .tiptap-editor .ProseMirror {
              outline: none;
              min-height: 400px;
              font-family: var(--font-sans);
              font-size: 14px;
              line-height: 1.7;
              color: var(--color-text-primary);
            }
            .tiptap-editor .ProseMirror h1 {
              font-family: var(--font-display);
              font-size: 22px;
              font-weight: 700;
              color: var(--color-text-primary);
              margin: 0 0 12px;
              line-height: 1.3;
            }
            .tiptap-editor .ProseMirror h2 {
              font-family: var(--font-display);
              font-size: 17px;
              font-weight: 700;
              color: var(--color-text-primary);
              margin: 20px 0 8px;
              border-bottom: 1px solid var(--color-border);
              padding-bottom: 4px;
            }
            .tiptap-editor .ProseMirror h3 {
              font-family: var(--font-sans);
              font-size: 14px;
              font-weight: 700;
              color: var(--color-text-primary);
              margin: 16px 0 6px;
            }
            .tiptap-editor .ProseMirror p {
              margin: 0 0 10px;
            }
            .tiptap-editor .ProseMirror p:last-child {
              margin-bottom: 0;
            }
            .tiptap-editor .ProseMirror ul,
            .tiptap-editor .ProseMirror ol {
              margin: 0 0 10px;
              padding-left: 24px;
            }
            .tiptap-editor .ProseMirror li {
              margin-bottom: 4px;
            }
            .tiptap-editor .ProseMirror hr {
              border: none;
              border-top: 1px solid var(--color-border);
              margin: 16px 0;
            }
            .tiptap-editor .ProseMirror strong {
              font-weight: 700;
            }
            .tiptap-editor .ProseMirror em {
              font-style: italic;
            }
            .tiptap-editor .ProseMirror u {
              text-decoration: underline;
            }
            .tiptap-editor .ProseMirror s {
              text-decoration: line-through;
            }
            .tiptap-editor .ProseMirror .is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              color: var(--color-text-secondary);
              opacity: 0.6;
              pointer-events: none;
              float: left;
              height: 0;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div className="tiptap-editor">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '16px',
      color: 'var(--color-text-secondary)',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: '#EFF6FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <FileText size={28} style={{ color: 'var(--color-primary)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
          marginBottom: '4px',
        }}>
          Aucun document sélectionné
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Sélectionnez un document dans la liste ou créez-en un nouveau
        </div>
      </div>
      <button
        type="button"
        onClick={onNew}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 18px',
          borderRadius: '8px',
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        <Plus size={15} />
        Nouveau document
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Notes() {
  const {
    filteredDocuments,
    templates,
    loading,
    filters,
    setFilters,
    selectedDoc,
    selectDoc,
    createFromTemplate,
    createBlankDocument,
    saveDocument,
    removeDocument,
  } = useNotesData();

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const newBtnRef = useRef<HTMLDivElement>(null);

  async function handleSelectTemplate(t: Document) {
    await createFromTemplate(t);
  }

  async function handleBlankDoc() {
    await createBlankDocument();
  }

  function handleSave(id: number, updates: Partial<Document>) {
    saveDocument(id, updates);
  }

  function handleDelete(id: number) {
    removeDocument(id);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px - 48px)',
      gap: 0,
    }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div className="eyebrow">
          Rédigez et archivez vos documents institutionnels
        </div>

        {/* New document button with dropdown */}
        <div ref={newBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowTemplateMenu((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(30,64,175,0.25)',
              transition: 'opacity 0.15s',
            }}
          >
            <Plus size={15} />
            Nouveau document
            <ChevronDown size={13} style={{
              marginLeft: '2px',
              transform: showTemplateMenu ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }} />
          </button>

          {showTemplateMenu && (
            <TemplateDropdown
              templates={templates}
              onSelectTemplate={handleSelectTemplate}
              onBlankDoc={handleBlankDoc}
              onClose={() => setShowTemplateMenu(false)}
            />
          )}
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flex: 1,
        gap: '0',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}>

        {/* ── Left panel — document list ─────────────────────────────────────── */}
        <div style={{
          width: '300px',
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search + type filter */}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
            background: '#FAFAF9',
          }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
                pointerEvents: 'none',
              }} />
              <input
                type="text"
                placeholder="Rechercher…"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '7px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Type filter */}
            <select
              value={filters.docType}
              onChange={(e) => setFilters({ ...filters, docType: e.target.value as DocType | '' })}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '7px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Tous les types</option>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{DOC_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>

          {/* Document list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                gap: '8px',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
              }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Chargement…
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
              }}>
                Aucun document trouvé
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <DocListItem
                  key={doc.id}
                  doc={doc}
                  isActive={selectedDoc?.id === doc.id}
                  onClick={() => selectDoc(doc)}
                />
              ))
            )}
          </div>

          {/* Document count */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--color-border)',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-sans)',
            background: '#FAFAF9',
            flexShrink: 0,
          }}>
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Right panel — editor ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selectedDoc ? (
            <EditorPanel
              key={selectedDoc.id}
              doc={selectedDoc}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ) : (
            <EmptyState onNew={handleBlankDoc} />
          )}
        </div>
      </div>
    </div>
  );
}
