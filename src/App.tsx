import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import KPIs from "@/pages/KPIs";
import Budget from "@/pages/Budget";
import Projects from "@/pages/Projects";
import Compliance from "@/pages/Compliance";
import Tutelles from "@/pages/Tutelles";
import Notes from "@/pages/Notes";
import Veille from "@/pages/Veille";
import Benchmarking from "@/pages/Benchmarking";
import Import from "@/pages/Import";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kpis" element={<KPIs />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/tutelles" element={<Tutelles />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/veille" element={<Veille />} />
          <Route path="/benchmarking" element={<Benchmarking />} />
          <Route path="/import" element={<Import />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
