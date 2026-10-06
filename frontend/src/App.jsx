import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import MachinesPage from "./pages/MachinesPage";
import UploadData from "./pages/UploadData";
import MaintenanceRecords from "./pages/MaintenanceRecords";
import AlertsPage from "./pages/AlertsPage";

import Layout from "./components/Layout";
import { AlertProvider } from "./context/AlertContext";

function App() {
  return (
    <BrowserRouter>
      <AlertProvider>
        <Layout>
          <Routes>
            {/* Home */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />

            {/* Dashboard (Fleet Overview) */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Machines (Individual Simulation & Diagnostics) */}
            <Route path="/machines" element={<MachinesPage />} />

            {/* Upload Data */}
            <Route path="/upload" element={<UploadData />} />

            {/* Maintenance Records */}
            <Route path="/maintenance" element={<MaintenanceRecords />} />

            {/* Alerts */}
            <Route path="/alerts" element={<AlertsPage />} />

            {/* Unknown URL */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Layout>
      </AlertProvider>
    </BrowserRouter>
  );
}

export default App;