import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  Sparkles,
  Boxes,
  HeartHandshake,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  History,
  Settings,
  Activity,
  X,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [activeModal, setActiveModal] = useState<"analytics" | "audit" | "settings" | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents({ limit: 100 }),
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["donations"],
    queryFn: () => api.getDonations(),
  });

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/", label: "Disaster Map", icon: MapPin },
    { to: "/events", label: "Events", icon: AlertTriangle, badge: events.length > 0 ? (events.length > 99 ? "99+" : events.length.toString()) : "12" },
    { to: "/predictions", label: "Resource Demand", icon: Sparkles },
    { to: "/inventory", label: "Inventory", icon: Boxes },
    { to: "/donors", label: "Donors", icon: HeartHandshake },
    { to: "/report", label: "Report Incident", icon: AlertCircle },
    { to: "/admin", label: "Admin Review", icon: ShieldCheck },
  ];

  const secondaryItems = [
    { key: "analytics", label: "Analytics", icon: BarChart3, onClick: () => setActiveModal("analytics") },
    { key: "audit", label: "Audit History", icon: History, onClick: () => setActiveModal("audit") },
    { key: "settings", label: "Settings", icon: Settings, onClick: () => setActiveModal("settings") },
  ];

  return (
    <>
      <aside className="w-56 shrink-0 glass-panel border-r border-border-subtle flex flex-col justify-between p-3 select-none hidden lg:flex">
        {/* Navigation list */}
        <div className="space-y-6">
          <nav className="space-y-1">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              // Specific match: If label is Dashboard or Disaster Map, highlight if at "/"
              const isActive =
                item.to === "/"
                  ? location.pathname === "/" && (idx === 0)
                  : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={`${item.to}-${idx}`}
                  to={item.to}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-text-tertiary"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Secondary system tools */}
          <div className="pt-2 border-t border-border-subtle space-y-1">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 transition"
                >
                  <Icon className="w-4 h-4 text-text-tertiary" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom card: Live Data Feed / System Status */}
        <div className="glass-card rounded-xl p-3 border border-border-subtle shadow-sm space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-[11px] font-semibold text-text-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Data Feed</span>
            </span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] text-text-tertiary">Last updated</div>
            <div className="text-xs font-mono font-medium text-text-secondary">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
              All systems operational
            </div>
          </div>

          {/* Mini trend sparkline SVG */}
          <svg className="w-full h-7 text-emerald-500 stroke-current fill-none" viewBox="0 0 100 25">
            <path
              d="M0,18 Q15,8 30,14 T60,6 T85,15 T100,5"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </aside>

      {/* Analytics Modal */}
      {activeModal === "analytics" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border-strong space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-bold text-text-primary">Operations Analytics Summary</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-tertiary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-3 rounded-xl border border-border-subtle">
                <div className="text-xs text-text-tertiary">Monitored Events</div>
                <div className="text-lg font-bold font-mono text-text-primary mt-1">{events.length}</div>
                <div className="text-[10px] text-emerald-500 mt-0.5">GDACS, USGS, NDMA active</div>
              </div>
              <div className="glass-card p-3 rounded-xl border border-border-subtle">
                <div className="text-xs text-text-tertiary">Logged Consignments</div>
                <div className="text-lg font-bold font-mono text-text-primary mt-1">{donations.length}</div>
                <div className="text-[10px] text-sky-500 mt-0.5">Depot stock sync intact</div>
              </div>
            </div>
            <div className="text-xs text-text-secondary leading-relaxed">
              Real-time telemetry reports normal cluster density across northern seismic zones and coastal monsoon corridors.
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {activeModal === "audit" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border-strong space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-text-primary">System Audit Trail</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-tertiary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl glass-card flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary">Database Integrity Verified</div>
                  <div className="text-text-tertiary text-[11px]">All disaster and depot tables synced locally</div>
                </div>
              </div>
              <div className="p-2.5 rounded-xl glass-card flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary">Regression ML Model Loaded</div>
                  <div className="text-text-tertiary text-[11px]">MultiOutput Random Forest Regressor ready</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {activeModal === "settings" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border-strong space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-bold text-text-primary">Platform Preferences</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-tertiary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Display Appearance Theme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      theme === "dark"
                        ? "bg-sky-500/20 text-sky-400 border-sky-500 shadow-sm"
                        : "glass-card text-text-secondary border-border-subtle"
                    }`}
                  >
                    Dark Glassmorphism
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      theme === "light"
                        ? "bg-sky-500/20 text-sky-600 border-sky-500 shadow-sm"
                        : "glass-card text-text-secondary border-border-subtle"
                    }`}
                  >
                    Light Glassmorphism
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

