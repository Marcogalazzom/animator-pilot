import { useMemo, useRef, useState, useEffect } from "react";
import { Settings, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AlertDropdown from "@/components/AlertDropdown";
import { getUnreadAlertCount } from "@/db/alerts";

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
  const dateDisplay = useMemo(() => {
    const d = formatFrenchDate(new Date());
    return d.charAt(0).toUpperCase() + d.slice(1);
  }, []);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  // Load unread count on mount
  useEffect(() => {
    getUnreadAlertCount().then(setUnreadCount).catch(() => {});
  }, []);

  // Close dropdown on outside click
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

  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{
        height: "56px",
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Left: establishment name + date */}
      <div className="flex items-center gap-4">
        <span
          className="font-semibold"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "var(--color-text-primary)",
          }}
        >
          Mon EHPAD
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          {dateDisplay}
        </span>
      </div>

      {/* Right: bell icon + settings icon */}
      <div className="flex items-center gap-1">
        {/* Bell with dropdown */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
            style={{ color: "var(--color-text-secondary)", position: "relative" }}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  backgroundColor: "var(--color-danger)",
                  color: "#fff",
                  borderRadius: "50%",
                  fontSize: "10px",
                  fontWeight: 700,
                  lineHeight: "14px",
                  width: "14px",
                  height: "14px",
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
            <AlertDropdown
              onUnreadChange={(count) => setUnreadCount(count)}
            />
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label="Paramètres"
          title="Paramètres"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
