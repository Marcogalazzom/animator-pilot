import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import type { ReactElement } from "react";
import {
  LayoutDashboard,
  Wallet,
  FolderKanban,
  FileText,
  CalendarDays,
  Palette,
  Heart,
  Package,
  Users,
  Camera,
  Upload,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import "./Sidebar.css";

interface NavLinkItemProps {
  to: string;
  end?: boolean;
  icon: ReactElement;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavLinkItemProps[];
}

const navGroups: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      { to: "/", end: true, icon: <LayoutDashboard size={18} />, label: "Tableau de bord" },
      { to: "/budget", icon: <Wallet size={18} />, label: "Budget" },
      { to: "/projects", icon: <FolderKanban size={18} />, label: "Projets" },
    ],
  },
  {
    id: "animation",
    label: "Animation",
    items: [
      { to: "/activities", icon: <Palette size={18} />, label: "Ateliers & Activités" },
      { to: "/residents", icon: <Heart size={18} />, label: "Résidents" },
      { to: "/photos", icon: <Camera size={18} />, label: "Photos & CR" },
      { to: "/calendar", icon: <CalendarDays size={18} />, label: "Calendrier" },
    ],
  },
  {
    id: "ressources",
    label: "Ressources",
    items: [
      { to: "/inventory", icon: <Package size={18} />, label: "Inventaire" },
      { to: "/staff", icon: <Users size={18} />, label: "Annuaire" },
      { to: "/notes", icon: <FileText size={18} />, label: "Notes" },
    ],
  },
  {
    id: "outils",
    label: "Outils",
    items: [
      { to: "/import", icon: <Upload size={18} />, label: "Import" },
    ],
  },
];

const STORAGE_KEY = "sidebar-collapsed-groups";

function loadCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveCollapsedGroups(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function NavLinkItem({ to, end, icon, label }: NavLinkItemProps) {
  return (
    <NavLink to={to} end={end} className="sidebar-nav-link">
      <span className="sidebar-nav-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function NavGroupSection({
  group,
  collapsed,
  onToggle,
}: {
  group: NavGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="sidebar-group">
      <button
        type="button"
        className="sidebar-group-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className="sidebar-group-label">{group.label}</span>
        <span className="sidebar-group-chevron">
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {!collapsed && (
        <div className="sidebar-group-items">
          {group.items.map((item) => (
            <NavLinkItem key={item.to} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    loadCollapsedGroups()
  );

  useEffect(() => {
    saveCollapsedGroups(collapsed);
  }, [collapsed]);

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-screen"
      style={{
        width: "240px",
        background: "linear-gradient(180deg, var(--color-sidebar) 0%, #1a2535 100%)",
      }}
    >
      {/* Logo / App name */}
      <div
        className="flex items-center gap-2 px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div
          className="flex items-center justify-center rounded-md shrink-0"
          style={{
            width: "28px",
            height: "28px",
            backgroundColor: "#7C3AED",
          }}
        >
          <span
            className="text-white font-bold"
            style={{ fontFamily: "var(--font-display)", fontSize: "14px", lineHeight: 1 }}
          >
            A
          </span>
        </div>
        <h1
          className="text-white font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "16px" }}
        >
          Pilot Animateur
        </h1>
      </div>

      {/* Main navigation with groups */}
      <nav className="flex-1 p-3 flex flex-col overflow-y-auto" aria-label="Navigation principale">
        {navGroups.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            collapsed={!!collapsed[group.id]}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
      </nav>

      {/* Separator + Settings */}
      <div
        className="p-3 flex flex-col gap-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <NavLinkItem
          to="/settings"
          icon={<Settings size={18} />}
          label="Paramètres"
        />
      </div>

      {/* Version */}
      <div className="px-6 pb-4">
        <span style={{ fontSize: "11px", color: "rgba(203,213,225,0.4)" }}>
          v0.1.0
        </span>
      </div>
    </aside>
  );
}
