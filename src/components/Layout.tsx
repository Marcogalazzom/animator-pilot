import { useState, useEffect, type ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import CommandPalette from "@/components/CommandPalette";
import ToastContainer from "@/components/Toast";
import UpdateBanner from "@/components/UpdateBanner";
import { evaluateAlerts } from "@/utils/alertEngine";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Run alert evaluation on mount and every 5 minutes
  useEffect(() => {
    evaluateAlerts().catch(() => {});
    const interval = setInterval(() => evaluateAlerts().catch(() => {}), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        window.dispatchEvent(new CustomEvent("close-modal"));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: "var(--color-bg)" }}>
      <UpdateBanner />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />

          <main
            className="flex-1 overflow-y-auto"
            style={{ padding: "24px" }}
            aria-label="Contenu principal"
          >
            {children}
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastContainer />
    </div>
  );
}
