import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { OperationalTicker } from "./components/OperationalTicker";
import { MapPage } from "./pages/MapPage";
import { EventsPage } from "./pages/EventsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { DonorsPage } from "./pages/DonorsPage";
import { PredictionsPage } from "./pages/PredictionsPage";
import { ReportDisasterPage } from "./pages/ReportDisasterPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppShell: React.FC = () => {
  const { theme } = useTheme();

  return (
    <BrowserRouter>
      {/* Atmospheric Panoramic Mountain Backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={
            theme === "light"
              ? "/src/assets/textures/mountain-backdrop-light.svg"
              : "/src/assets/textures/mountain-backdrop.svg"
          }
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover opacity-45 dark:opacity-40 transition-opacity duration-500 scale-105"
        />
        <div className="absolute inset-0 bg-[#F3F6FC]/70 dark:bg-slate-950/80 backdrop-blur-[2px] transition-colors duration-300" />
      </div>

      {/* Platform Application Shell */}
      <div className="relative z-10 min-h-screen flex flex-col font-sans overflow-x-hidden text-text-primary selection:bg-blue-500/25 selection:text-blue-600 dark:selection:text-sky-400">
        <Navbar />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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

        <OperationalTicker />
      </div>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
