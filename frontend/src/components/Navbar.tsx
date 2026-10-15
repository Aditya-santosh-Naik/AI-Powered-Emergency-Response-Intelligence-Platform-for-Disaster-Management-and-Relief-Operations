import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  AlertTriangle,
  Boxes,
  HeartHandshake,
  RefreshCw,
  Activity,
} from "lucide-react";
import { api } from "../api/client";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

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
    { to: "/events", label: "Disaster Events", icon: AlertTriangle },
    { to: "/inventory", label: "Resource Inventory", icon: Boxes },
    { to: "/donors", label: "Donors & Aid", icon: HeartHandshake },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/40">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-base tracking-wide">Emergency Response Intelligence</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                WEEKS 1–2
              </span>
            </div>
            <p className="text-xs text-slate-400">Data Ingestion & Geospatial Impact Assessment</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex space-x-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-red-400" : "text-slate-400"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Actions & Connection Status */}
        <div className="flex items-center space-x-3">
          {/* Ingestion Trigger Button */}
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-medium transition shadow-sm disabled:opacity-50"
            title="Poll GDACS, USGS, NDMA and satellite feeds now"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${triggerMutation.isPending ? "animate-spin text-amber-400" : ""}`} />
            <span>{triggerMutation.isPending ? "Syncing..." : "Sync Feeds"}</span>
          </button>

          {/* Backend Connection Indicator */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
              isSuccess
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                : "bg-red-950/60 border-red-800 text-red-400"
            }`}
          >
            {isSuccess ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Backend Online</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>API Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
