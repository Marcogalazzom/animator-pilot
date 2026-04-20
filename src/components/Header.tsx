import { useMemo, useRef, useState, useEffect } from "react";
import { Bell, Plus, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import AlertDropdown from "@/components/AlertDropdown";
import { SyncBadge } from "@/components/SyncIndicator";
import { getUnreadAlertCount } from "@/db/alerts";

const ROUTE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/":             { title: "Accueil" },
  "/budget":       { title: "Budget" },
  "/projects":     { title: "Projets" },
  "/notes":        { title: "Notes" },
  "/calendar":     { title: "Calendrier" },
  "/activities":   { title: "Activités" },
  "/appointments": { title: "Rendez-vous" },
  "/residents":    { title: "Résidents" },
  "/inventory":    { title: "Inventaire" },
  "/staff":        { title: "Annuaire" },
  "/photos":       { title: "Photos" },
  "/famileo":      { title: "Famileo" },
  "/journal":      { title: "Carnet de bord" },
  "/suppliers":    { title: "Fournisseurs" },
  "/import":       { title: "Import" },
  "/settings":     { title: "Paramètres" },
};

function formatFrenchDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const dateDisplay = useMemo(() => {
    const d = formatFrenchDate(new Date());
    return d.charAt(0).toUpperCase() + d.slice(1);
  }, []);

  const route = ROUTE_TITLES[pathname] ?? { title: "Pilot Animateur" };
  const subtitle = pathname === "/" ? dateDisplay : route.subtitle;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUnreadAlertCount().then(setUnreadCount).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function handleNewActivity() {
    window.dispatchEvent(new CustomEvent("open-new-activity"));
    if (pathname !== "/activities") navigate("/activities");
  }

  return (
    <header
      className="flex-shrink-0"
      style={{
        background: "var(--bg)",
        padding: "18px 28px 14px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
      }}
    >
      {/* Title + optional subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          className="serif"
          style={{
            margin: 0,
            fontSize: "var(--t-h1)",
            fontWeight: 500,
            letterSpacing: -0.6,
            lineHeight: 1.15,
            color: "var(--ink)",
          }}
        >
          {route.title}
        </h1>
        {subtitle && (
          <div
            style={{
              fontSize: 14,
              color: "var(--ink-3)",
              marginTop: 3,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Search pill (placeholder — wired to ⌘K palette) */}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 999,
          padding: "6px 14px",
          width: 280,
          color: "var(--ink-3)",
          fontSize: 13,
          textAlign: "left",
        }}
        aria-label="Rechercher (⌘K)"
      >
        <Search size={15} />
        <span>Rechercher…</span>
        <span style={{ flex: 1 }} />
        <span className="kbd">⌘K</span>
      </button>

      {/* Sync badge */}
      <SyncBadge />

      {/* Bell with dropdown */}
      <div ref={bellRef} style={{ position: "relative" }}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="btn"
          style={{
            padding: 8,
            borderRadius: "50%",
            position: "relative",
          }}
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "var(--terra-deep)",
                color: "#fff",
                borderRadius: "50%",
                fontSize: 10,
                fontWeight: 700,
                lineHeight: "14px",
                width: 14,
                height: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {dropdownOpen && (
          <AlertDropdown onUnreadChange={(count) => setUnreadCount(count)} />
        )}
      </div>

      {/* Primary action — Nouvelle activité */}
      <button className="btn primary" onClick={handleNewActivity}>
        <Plus size={14} strokeWidth={2.5} />
        Nouvelle activité
      </button>
    </header>
  );
}
