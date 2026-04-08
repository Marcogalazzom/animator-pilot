import { NavLink } from "react-router-dom";
import type { ReactElement } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  FolderKanban,
  ShieldCheck,
  Landmark,
  FileText,
  CalendarDays,
  BookOpen,
  Activity,
  Upload,
  Settings,
} from "lucide-react";

import "./Sidebar.css";

interface NavLinkItemProps {
  to: string;
  end?: boolean;
  icon: ReactElement;
  label: string;
}

const mainNavItems: NavLinkItemProps[] = [
  { to: "/", end: true, icon: <LayoutDashboard size={18} />, label: "Tableau de bord" },
  { to: "/kpis", icon: <BarChart3 size={18} />, label: "KPIs" },
  { to: "/budget", icon: <Wallet size={18} />, label: "Budget" },
  { to: "/projects", icon: <FolderKanban size={18} />, label: "Projets" },
  { to: "/compliance", icon: <ShieldCheck size={18} />, label: "Conformité" },
  { to: "/tutelles", icon: <Landmark size={18} />, label: "Tutelles" },
  { to: "/notes", icon: <FileText size={18} />, label: "Notes" },
  { to: "/calendar", icon: <CalendarDays size={18} />, label: "Calendrier" },
  { to: "/veille", icon: <BookOpen size={18} />, label: "Veille" },
  { to: "/benchmarking", icon: <Activity size={18} />, label: "ANAP" },
  { to: "/import", icon: <Upload size={18} />, label: "Import" },
];

function NavLinkItem({ to, end, icon, label }: NavLinkItemProps) {
  return (
    <NavLink to={to} end={end} className="sidebar-nav-link">
      <span className="sidebar-nav-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
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
            backgroundColor: "var(--color-primary)",
          }}
        >
          <span
            className="text-white font-bold"
            style={{ fontFamily: "var(--font-display)", fontSize: "14px", lineHeight: 1 }}
          >
            E
          </span>
        </div>
        <h1
          className="text-white font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}
        >
          EHPAD Pilot
        </h1>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5" aria-label="Navigation principale">
        {mainNavItems.map((item) => (
          <NavLinkItem key={item.to} {...item} />
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
