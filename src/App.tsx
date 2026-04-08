import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import KPIs from "./pages/KPIs";
import Projects from "./pages/Projects";
import Import from "./pages/Import";
import Settings from "./pages/Settings";

function Sidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">EHPAD Pilot</h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/" end className={linkClass}>
          Tableau de bord
        </NavLink>
        <NavLink to="/kpis" className={linkClass}>
          KPIs
        </NavLink>
        <NavLink to="/projects" className={linkClass}>
          Projets
        </NavLink>
        <NavLink to="/import" className={linkClass}>
          Import
        </NavLink>
      </nav>
      <div className="p-3 border-t border-gray-200">
        <NavLink to="/settings" className={linkClass}>
          Paramètres
        </NavLink>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kpis" element={<KPIs />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/import" element={<Import />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
