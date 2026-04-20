import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import type { ReactElement } from "react";
import {
  Home,
  Sparkles,
  CalendarDays,
  Heart,
  Camera,
  Newspaper,
  FolderKanban,
  Wallet,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  Package,
  Users,
  FileText,
  Store,
  Upload,
} from "lucide-react";

import "./Sidebar.css";
import { currentVersion } from "../utils/updater";
import { useUserSettings } from "@/hooks/useUserSettings";

interface NavLinkItemProps {
  to: string;
  end?: boolean;
  icon: ReactElement;
  label: string;
}

const PRIMARY_NAV: NavLinkItemProps[] = [
  { to: "/",           end: true, icon: <Home size={18} />,         label: "Accueil" },
  { to: "/activities", icon: <Sparkles size={18} />,                label: "Activités" },
  { to: "/calendar",   icon: <CalendarDays size={18} />,            label: "Calendrier" },
  { to: "/residents",  icon: <Heart size={18} />,                   label: "Résidents" },
  { to: "/photos",     icon: <Camera size={18} />,                  label: "Photos" },
  { to: "/famileo",    icon: <Newspaper size={18} />,               label: "Famileo" },
  { to: "/projects",   icon: <FolderKanban size={18} />,            label: "Projets" },
  { to: "/budget",     icon: <Wallet size={18} />,                  label: "Budget" },
  { to: "/journal",    icon: <BookOpen size={18} />,                label: "Carnet de bord" },
];

const SECONDARY_NAV: NavLinkItemProps[] = [
  { to: "/appointments", icon: <CalendarClock size={18} />, label: "Rendez-vous" },
  { to: "/inventory",    icon: <Package size={18} />,       label: "Inventaire" },
  { to: "/staff",        icon: <Users size={18} />,         label: "Annuaire" },
  { to: "/notes",        icon: <FileText size={18} />,      label: "Notes" },
  { to: "/suppliers",    icon: <Store size={18} />,         label: "Fournisseurs" },
  { to: "/import",       icon: <Upload size={18} />,        label: "Import" },
];

const PLUS_OPEN_KEY = "sidebar-plus-open";

function NavLinkItem({ to, end, icon, label }: NavLinkItemProps) {
  return (
    <NavLink to={to} end={end} className="sidebar-nav-link">
      <span className="sidebar-nav-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const settings = useUserSettings();
  const [appVersion, setAppVersion] = useState<string>("…");
  const [plusOpen, setPlusOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(PLUS_OPEN_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    currentVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PLUS_OPEN_KEY, plusOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [plusOpen]);

  const initials =
    (settings.user_first_name?.[0] ?? "?").toUpperCase() +
    (settings.user_last_name?.[0]  ?? "").toUpperCase();
  const fullName = [settings.user_first_name, settings.user_last_name].filter(Boolean).join(" ");

  return (
    <aside
      className="flex flex-col shrink-0 h-screen"
      style={{
        width: 240,
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Brand block */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 18px" }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--terra)", color: "#fff",
            display: "grid", placeItems: "center",
            fontWeight: 700, fontFamily: "var(--font-serif)",
            fontSize: 18, letterSpacing: -0.5,
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.15) inset, 0 1px 2px rgba(0,0,0,0.15)",
          }}
        >
          P
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="serif"
            style={{
              fontWeight: 600, fontSize: 16,
              letterSpacing: -0.3, lineHeight: 1,
              color: "var(--ink)",
            }}
          >
            {settings.residence_name}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
            {settings.residence_kind}
          </div>
        </div>
      </div>

      {/* Main nav (9 primary items) */}
      <nav
        className="flex-1 px-3 flex flex-col overflow-y-auto"
        aria-label="Navigation principale"
        style={{ gap: 2 }}
      >
        {PRIMARY_NAV.map((item) => (
          <NavLinkItem key={item.to} {...item} />
        ))}

        {/* Plus section */}
        <div className="sidebar-group" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="sidebar-group-header"
            onClick={() => setPlusOpen((v) => !v)}
            aria-expanded={plusOpen}
          >
            <span className="sidebar-group-label">Plus</span>
            <span className="sidebar-group-chevron">
              {plusOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </button>
          {plusOpen && (
            <div className="sidebar-group-items">
              {SECONDARY_NAV.map((item) => (
                <NavLinkItem key={item.to} {...item} />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Settings */}
      <div className="px-3 pt-2 flex flex-col gap-0.5">
        <NavLinkItem
          to="/settings"
          icon={<Settings size={18} />}
          label="Paramètres"
        />
      </div>

      {/* User pill */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px 10px", margin: "8px 12px 0",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "var(--sage-soft)", color: "var(--sage-deep)",
            display: "grid", placeItems: "center",
            fontWeight: 600, fontSize: 13,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600, fontSize: 13,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              color: "var(--ink)",
            }}
          >
            {fullName || "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {settings.user_role}
          </div>
        </div>
      </div>

      <div style={{ padding: "4px 16px 12px" }}>
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>v{appVersion}</span>
      </div>
    </aside>
  );
}
