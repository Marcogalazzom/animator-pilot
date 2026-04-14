import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";

const Dashboard   = lazy(() => import("@/pages/Dashboard"));
const Budget      = lazy(() => import("@/pages/Budget"));
const Projects    = lazy(() => import("@/pages/Projects"));
const Notes       = lazy(() => import("@/pages/Notes"));
const Calendar    = lazy(() => import("@/pages/Calendar"));
const Activities  = lazy(() => import("@/pages/Activities"));
const Appointments = lazy(() => import("@/pages/Appointments"));
const Residents   = lazy(() => import("@/pages/Residents"));
const Inventory   = lazy(() => import("@/pages/Inventory"));
const Staff       = lazy(() => import("@/pages/Staff"));
const Photos      = lazy(() => import("@/pages/Photos"));
const Famileo     = lazy(() => import("@/pages/Famileo"));
const Journal     = lazy(() => import("@/pages/Journal"));
const Suppliers   = lazy(() => import("@/pages/Suppliers"));
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
            <Route path="/budget"      element={<Budget />} />
            <Route path="/projects"    element={<Projects />} />
            <Route path="/notes"       element={<Notes />} />
            <Route path="/calendar"    element={<Calendar />} />
            <Route path="/activities"  element={<Activities />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/residents"   element={<Residents />} />
            <Route path="/inventory"   element={<Inventory />} />
            <Route path="/staff"       element={<Staff />} />
            <Route path="/photos"      element={<Photos />} />
            <Route path="/famileo"     element={<Famileo />} />
            <Route path="/journal"     element={<Journal />} />
            <Route path="/suppliers"   element={<Suppliers />} />
            <Route path="/import"      element={<Import />} />
            <Route path="/settings"    element={<Settings />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
