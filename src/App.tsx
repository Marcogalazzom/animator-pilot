import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";

const Dashboard   = lazy(() => import("@/pages/Dashboard"));
const KPIs        = lazy(() => import("@/pages/KPIs"));
const Budget      = lazy(() => import("@/pages/Budget"));
const Projects    = lazy(() => import("@/pages/Projects"));
const Compliance  = lazy(() => import("@/pages/Compliance"));
const Tutelles    = lazy(() => import("@/pages/Tutelles"));
const Notes       = lazy(() => import("@/pages/Notes"));
const Calendar    = lazy(() => import("@/pages/Calendar"));
const Veille      = lazy(() => import("@/pages/Veille"));
const Benchmarking = lazy(() => import("@/pages/Benchmarking"));
const Import      = lazy(() => import("@/pages/Import"));
const Settings    = lazy(() => import("@/pages/Settings"));

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense
          fallback={
            <div style={{ padding: 40, color: "var(--color-text-secondary)" }}>
              Chargement...
            </div>
          }
        >
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/kpis"        element={<KPIs />} />
            <Route path="/budget"      element={<Budget />} />
            <Route path="/projects"    element={<Projects />} />
            <Route path="/compliance"  element={<Compliance />} />
            <Route path="/tutelles"    element={<Tutelles />} />
            <Route path="/notes"       element={<Notes />} />
            <Route path="/calendar"    element={<Calendar />} />
            <Route path="/veille"      element={<Veille />} />
            <Route path="/benchmarking" element={<Benchmarking />} />
            <Route path="/import"      element={<Import />} />
            <Route path="/settings"    element={<Settings />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
