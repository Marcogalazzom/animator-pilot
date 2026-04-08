import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FolderKanban,
  ShieldCheck,
  FileText,
  Landmark,
  BookOpen,
  BarChart3,
  Plus,
  X,
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/db/search";

// ─── Types ────────────────────────────────────────────────────

type ModuleKey = SearchResult["module"];

interface QuickAction {
  label: string;
  path: string;
  icon: React.ReactNode;
}

// ─── Constants ────────────────────────────────────────────────

const MODULE_META: Record<
  ModuleKey,
  { label: string; icon: React.ReactNode; color: string }
> = {
  projets: {
    label: "Projets",
    icon: <FolderKanban size={15} />,
    color: "#1E40AF",
  },
  conformite: {
    label: "Conformité",
    icon: <ShieldCheck size={15} />,
    color: "#059669",
  },
  notes: {
    label: "Notes",
    icon: <FileText size={15} />,
    color: "#D97706",
  },
  tutelles: {
    label: "Tutelles",
    icon: <Landmark size={15} />,
    color: "#7C3AED",
  },
  veille: {
    label: "Veille",
    icon: <BookOpen size={15} />,
    color: "#64748B",
  },
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Nouveau projet", path: "/projects", icon: <FolderKanban size={16} /> },
  { label: "Nouvelle note", path: "/notes", icon: <FileText size={16} /> },
  { label: "Saisir un KPI", path: "/kpis", icon: <BarChart3 size={16} /> },
  { label: "Nouvel événement", path: "/tutelles", icon: <Landmark size={16} /> },
];

// ─── Helpers ──────────────────────────────────────────────────

function groupByModule(results: SearchResult[]): Map<ModuleKey, SearchResult[]> {
  const map = new Map<ModuleKey, SearchResult[]>();
  for (const r of results) {
    if (!map.has(r.module)) map.set(r.module, []);
    map.get(r.module)!.push(r);
  }
  return map;
}

// ─── Component ────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await globalSearch(query);
        setResults(res);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Flat navigable items count
  const itemCount = query.trim() ? results.length : QUICK_ACTIONS.length;

  const navigateTo = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard handler
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(itemCount, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!query.trim()) {
          const action = QUICK_ACTIONS[activeIndex];
          if (action) navigateTo(action.path);
        } else {
          const result = results[activeIndex];
          if (result) navigateTo(result.link_path);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, activeIndex, itemCount, query, results, navigateTo]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-active="true"]`) as HTMLElement | null;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const grouped = groupByModule(results);
  const showEmpty = query.trim() && !isSearching && results.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
          backgroundColor: "rgba(15, 23, 42, 0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "cp-fade-in 120ms ease-out",
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        style={{
          position: "fixed",
          top: "15vh",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          width: "560px",
          maxWidth: "calc(100vw - 32px)",
          backgroundColor: "var(--color-surface)",
          borderRadius: "14px",
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,0.08), 0 20px 60px -8px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
          animation: "cp-slide-in 160ms cubic-bezier(0.16, 1, 0.3, 1)",
          maxHeight: "480px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search input row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <Search
            size={18}
            style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher projets, conformité, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "16px",
              fontFamily: "var(--font-sans)",
              color: "var(--color-text-primary)",
              backgroundColor: "transparent",
              caretColor: "var(--color-primary)",
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label="Effacer"
            >
              <X size={11} />
            </button>
          )}
          <kbd
            style={{
              fontSize: "11px",
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontFamily: "var(--font-sans)",
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results / Quick actions */}
        <div
          ref={listRef}
          style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}
        >
          {/* Empty query → quick actions */}
          {!query.trim() && (
            <>
              <div style={sectionHeaderStyle}>Actions rapides</div>
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={action.path + action.label}
                  data-active={activeIndex === i ? "true" : "false"}
                  onClick={() => navigateTo(action.path)}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={itemStyle(activeIndex === i)}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      backgroundColor: activeIndex === i
                        ? "rgba(30, 64, 175, 0.12)"
                        : "var(--color-bg)",
                      color: "var(--color-primary)",
                      flexShrink: 0,
                      transition: "background-color 120ms",
                    }}
                  >
                    <Plus size={14} />
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      color: "var(--color-text-primary)",
                      fontFamily: "var(--font-sans)",
                      flex: 1,
                      textAlign: "left",
                    }}
                  >
                    {action.label}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {action.icon}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Searching indicator */}
          {isSearching && (
            <div
              style={{
                padding: "24px 20px",
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: "13px",
                fontFamily: "var(--font-sans)",
              }}
            >
              Recherche en cours…
            </div>
          )}

          {/* Empty results */}
          {showEmpty && (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
              }}
            >
              Aucun résultat pour «{" "}
              <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                {query}
              </span>{" "}
              »
            </div>
          )}

          {/* Results grouped by module */}
          {!isSearching && query.trim() && results.length > 0 && (() => {
            let globalIdx = 0;
            return Array.from(grouped.entries()).map(([module, items]) => {
              const meta = MODULE_META[module];
              return (
                <div key={module}>
                  <div style={sectionHeaderStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        color: meta.color,
                      }}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                  {items.map((result) => {
                    const idx = globalIdx++;
                    return (
                      <button
                        key={`${module}-${result.id}`}
                        data-active={activeIndex === idx ? "true" : "false"}
                        onClick={() => navigateTo(result.link_path)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        style={itemStyle(activeIndex === idx)}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            borderRadius: "7px",
                            backgroundColor: activeIndex === idx
                              ? hexToAlpha(meta.color, 0.12)
                              : hexToAlpha(meta.color, 0.07),
                            color: meta.color,
                            flexShrink: 0,
                            transition: "background-color 120ms",
                          }}
                        >
                          {meta.icon}
                        </span>
                        <span
                          style={{
                            fontSize: "14px",
                            color: "var(--color-text-primary)",
                            fontFamily: "var(--font-sans)",
                            flex: 1,
                            textAlign: "left",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {result.title}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: meta.color,
                            backgroundColor: hexToAlpha(meta.color, 0.1),
                            borderRadius: "4px",
                            padding: "2px 7px",
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          {meta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* Footer hint */}
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            padding: "8px 20px",
            display: "flex",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          {[
            { key: "↑↓", label: "naviguer" },
            { key: "↵", label: "ouvrir" },
            { key: "Échap", label: "fermer" },
          ].map(({ key, label }) => (
            <span
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <kbd
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "4px",
                  padding: "1px 5px",
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cp-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.97); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

// ─── Style helpers ────────────────────────────────────────────

const sectionHeaderStyle: React.CSSProperties = {
  padding: "6px 20px 4px",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-sans)",
};

function itemStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "7px 20px",
    border: "none",
    backgroundColor: active ? "var(--color-bg)" : "transparent",
    cursor: "pointer",
    transition: "background-color 80ms",
    borderLeft: active ? "2px solid var(--color-primary)" : "2px solid transparent",
  };
}

function hexToAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
