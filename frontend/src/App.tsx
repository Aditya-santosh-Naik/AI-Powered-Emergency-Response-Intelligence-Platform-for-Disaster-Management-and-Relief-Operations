import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "./components/Navbar";
import { MapPage } from "./pages/MapPage";
import { EventsPage } from "./pages/EventsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { DonorsPage } from "./pages/DonorsPage";
import { PredictionsPage } from "./pages/PredictionsPage";

import { AuthProvider } from "./context/AuthContext";
import { ReportDisasterPage } from "./pages/ReportDisasterPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-qc-bg text-qc-text-primary flex flex-col font-sans selection:bg-qc-accent/20 selection:text-qc-accent">
            <Navbar />
            <main className="flex-1 flex flex-col">
              <Routes>
                <Route path="/" element={<MapPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/predictions" element={<PredictionsPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/donors" element={<DonorsPage />} />
                <Route path="/report" element={<ReportDisasterPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
