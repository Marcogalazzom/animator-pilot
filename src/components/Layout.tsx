import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-bg)" }}>
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Right column: header + scrollable content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Fixed header */}
        <Header />

        {/* Scrollable main content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            padding: "24px",
            backgroundColor: "var(--color-bg)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
