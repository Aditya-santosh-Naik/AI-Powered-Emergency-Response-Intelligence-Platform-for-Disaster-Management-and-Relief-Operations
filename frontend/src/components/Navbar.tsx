import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  AlertTriangle,
  Boxes,
  HeartHandshake,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, isAdmin, logout, quickSwitchDemo } = useAuth();

  const { isSuccess } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: 10000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerIngestion(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["grid-cells"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-status"] });
    },
  });

  const navLinks = [
    { to: "/", label: "Disaster Map", icon: MapPin },
    { to: "/events", label: "Events", icon: AlertTriangle },
    { to: "/predictions", label: "Resource Demand", icon: Sparkles },
    { to: "/inventory", label: "Inventory", icon: Boxes },
    { to: "/donors", label: "Donors", icon: HeartHandshake },
    { to: "/report", label: "Report Incident", icon: AlertCircle },
    { to: "/admin", label: "Admin Review", icon: ShieldCheck },
  ];

  return (
    <header className="bg-qc-sidebar/95 backdrop-blur-md border-b border-qc-border-subtle sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group shrink-0">
          <div className="w-9 h-9 rounded-lg bg-qc-surface-2 border border-qc-border-strong flex items-center justify-center p-1.5 shadow-md shadow-sky-950/20 group-hover:border-qc-accent/60 transition-colors">
            <img src="/src/assets/brand/mark.svg" alt="" aria-hidden="true" className="w-full h-full" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-qc-text-primary text-sm tracking-tight">
                Emergency Response Platform
              </span>
              <span className="text-[10px] bg-qc-surface-2 text-qc-text-secondary px-1.5 py-0.5 rounded border border-qc-border-subtle font-mono uppercase">
                W1–4
              </span>
            </div>
            <p className="text-[11px] text-qc-text-tertiary">
              Impact Assessment & Resource Intelligence
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-qc-surface-2 text-qc-text-primary border border-qc-border-strong shadow-sm"
                    : "text-qc-text-secondary hover:text-qc-text-primary hover:bg-qc-surface-1"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? "text-qc-accent" : "text-qc-text-tertiary"
                  }`}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Sync, Demo Auth, Connectivity */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Feed Sync Trigger */}
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="flex items-center space-x-1.5 bg-qc-surface-1 hover:bg-qc-surface-2 text-qc-text-secondary hover:text-qc-text-primary border border-qc-border-subtle hover:border-qc-border-strong px-2.5 py-1.5 rounded-md text-xs font-medium transition shadow-sm disabled:opacity-50"
            title="Poll GDACS, USGS, NDMA and satellite feeds now"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                triggerMutation.isPending ? "animate-spin text-amber-400" : "text-qc-text-tertiary"
              }`}
            />
            <span className="hidden sm:inline">
              {triggerMutation.isPending ? "Syncing..." : "Sync Feeds"}
            </span>
          </button>

          {/* Auth Switcher */}
          {user ? (
            <div className="flex items-center space-x-2 bg-qc-surface-1 border border-qc-border-subtle rounded-md px-2.5 py-1 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAdmin ? "bg-emerald-400" : "bg-sky-400"
                }`}
              />
              <span className="text-qc-text-primary font-medium truncate max-w-[100px]">
                {user.full_name.split(" ")[0]}
              </span>
              <span className="font-mono text-[10px] uppercase bg-qc-surface-2 text-qc-text-tertiary px-1.5 py-0.5 rounded border border-qc-border-subtle">
                {user.role}
              </span>
              <button
                onClick={logout}
                title="Sign out"
                className="text-qc-text-tertiary hover:text-red-400 ml-0.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => quickSwitchDemo("reporter")}
                className="px-2 py-1 bg-qc-surface-1 hover:bg-qc-surface-2 text-qc-text-secondary hover:text-qc-text-primary border border-qc-border-subtle rounded text-xs transition"
                title="Sign in as Field Reporter (Demo)"
              >
                Reporter
              </button>
              <button
                onClick={() => quickSwitchDemo("admin")}
                className="px-2 py-1 bg-qc-surface-2 hover:bg-qc-surface-3 text-qc-accent border border-qc-border-strong rounded text-xs font-medium transition"
                title="Sign in as Relief Admin (Demo)"
              >
                Admin
              </button>
            </div>
          )}

          {/* Backend Connection Indicator */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              isSuccess
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-400"
                : "bg-red-950/60 border-red-800/80 text-red-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isSuccess ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="hidden sm:inline">
              {isSuccess ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Nav strip for screens < 1024px */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-1.5 border-t border-qc-border-subtle bg-qc-bg space-x-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                isActive
                  ? "bg-qc-surface-2 text-qc-text-primary border border-qc-border-strong font-medium"
                  : "text-qc-text-secondary hover:text-qc-text-primary"
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
