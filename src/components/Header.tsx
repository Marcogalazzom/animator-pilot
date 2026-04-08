import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const today = formatFrenchDate(new Date());
  // Capitalize first letter (weekday)
  const dateDisplay = today.charAt(0).toUpperCase() + today.slice(1);

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
          className="hidden sm:block"
          style={{
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          {dateDisplay}
        </span>
      </div>

      {/* Right: settings icon */}
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 hover:bg-gray-100"
        style={{ color: "var(--color-text-secondary)" }}
        aria-label="Paramètres"
        title="Paramètres"
      >
        <Settings size={16} />
      </button>
    </header>
  );
}
