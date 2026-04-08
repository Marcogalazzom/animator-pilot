import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  FolderKanban,
  Upload,
  Settings,
} from "lucide-react";

interface NavItem {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
}

const mainNavItems: NavItem[] = [
  { to: "/", end: true, icon: <LayoutDashboard size={18} />, label: "Tableau de bord" },
  { to: "/kpis", icon: <BarChart3 size={18} />, label: "KPIs" },
  { to: "/projects", icon: <FolderKanban size={18} />, label: "Projets" },
  { to: "/import", icon: <Upload size={18} />, label: "Import" },
];

interface NavLinkItemProps {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
}

function NavLinkItem({ to, end, icon, label }: NavLinkItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        paddingLeft: "13px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 500,
        textDecoration: "none",
        transition: "all 150ms ease",
        color: isActive ? "#FFFFFF" : "#CBD5E1",
        borderLeft: isActive
          ? "3px solid #1E40AF"
          : "3px solid transparent",
        backgroundColor: isActive
          ? "rgba(255,255,255,0.08)"
          : "transparent",
      })}
      onMouseEnter={(e) => {
        const target = e.currentTarget;
        if (!target.classList.contains("active")) {
          target.style.backgroundColor = "rgba(255,255,255,0.04)";
          target.style.color = "#FFFFFF";
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget;
        // Only reset if not active (active state is managed by style prop)
        // The style prop will re-apply on next render, but we reset for non-active
        const isActiveLink = target.getAttribute("aria-current") === "page";
        if (!isActiveLink) {
          target.style.backgroundColor = "transparent";
          target.style.color = "#CBD5E1";
        }
      }}
    >
      <span style={{ flexShrink: 0, opacity: 0.85, display: "flex" }}>
        {icon}
      </span>
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
        background: "linear-gradient(180deg, #1E293B 0%, #1a2535 100%)",
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
            backgroundColor: "#1E40AF",
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
      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {mainNavItems.map((item) => (
          <NavLinkItem
            key={item.to}
            to={item.to}
            end={item.end}
            icon={item.icon}
            label={item.label}
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
