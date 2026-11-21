import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Package,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Navigation,
} from "lucide-react";
import { api } from "../api/client";
import type { ReliefMission } from "../types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonCard } from "../components/ui/SkeletonLoader";

export const MissionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Queries
  const {
    data: missions = [],
    isLoading,
    refetch,
  } = useQuery<ReliefMission[]>({
    queryKey: ["missions", statusFilter],
    queryFn: () =>
      api.listMissions({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 100,
      }),
    refetchInterval: 10000,
  });

  // Status Advancement Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.updateMissionStatus(id, { status, notes }),
    onSuccess: (updated) => {
      setActionSuccess(`Mission ${updated.mission_code} transitioned to ${updated.status}!`);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to update mission status.");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "ASSIGNED":
        return <Badge variant="severity-high">ASSIGNED</Badge>;
      case "DISPATCHED":
        return <Badge variant="info">DISPATCHED</Badge>;
      case "IN_TRANSIT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            IN TRANSIT
          </span>
        );
      case "DELIVERED":
        return <Badge variant="success">DELIVERED</Badge>;
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> COMPLETED
          </span>
        );
      case "CANCELLED":
        return <Badge variant="severity-critical">CANCELLED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredMissions = missions.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.mission_code || "").toLowerCase().includes(q) ||
      (m.depot_name || "").toLowerCase().includes(q) ||
      (m.zone_identifier || "").toLowerCase().includes(q) ||
      (m.team_leader || "").toLowerCase().includes(q)
    );
  });

  const handleAdvanceStatus = (mission: ReliefMission) => {
    const current = (mission.status || "").toUpperCase();
    let nextStatus = "";
    if (current === "ASSIGNED") nextStatus = "DISPATCHED";
    else if (current === "DISPATCHED") nextStatus = "IN_TRANSIT";
    else if (current === "IN_TRANSIT") nextStatus = "DELIVERED";
    else if (current === "DELIVERED") nextStatus = "COMPLETED";

    if (nextStatus) {
      updateStatusMutation.mutate({
        id: mission.id,
        status: nextStatus,
        notes: `Operational status advanced to ${nextStatus}`,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in-up">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-sky-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Truck className="w-4 h-4" />
            Field Operations & Multi-State Logistics Dispatch
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Relief Mission Operations Panel
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Track multi-modal relief convoys from supply depots to disaster zones. Monitor stock
            manifests, transit waypoints, and verify delivery signatures.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh Convoys
          </Button>
        </div>
      </div>

      {/* ── Alerts ────────────────────────────────────────────── */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <ErrorState
          title="Status Transition Error"
          message={actionError}
          onRetry={() => setActionError(null)}
        />
      )}

      {/* ── Filters and Search Strip ───────────────────────────── */}
      <div className="glass-panel rounded-2xl p-4 shadow-sm border border-border-subtle flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-80 bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs">
          <Search className="w-4 h-4 text-text-tertiary shrink-0" />
          <input
            type="text"
            placeholder="Search mission code, depot, zone, leader..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-text-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            "ALL",
            "ASSIGNED",
            "DISPATCHED",
            "IN_TRANSIT",
            "DELIVERED",
            "COMPLETED",
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-sm dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600"
                  : "bg-slate-100 dark:bg-slate-800 text-text-secondary hover:text-text-primary border border-border-subtle"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Missions List ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : filteredMissions.length === 0 ? (
        <EmptyState
          title="No Relief Missions Found"
          description={
            statusFilter !== "ALL"
              ? `No missions currently match status '${statusFilter}'.`
              : "Generate missions from an active allocation plan in the Command Center."
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredMissions.map((mission) => {
            const isExpanded = expandedMissionId === mission.id;
            const currentStatus = (mission.status || "").toUpperCase();
            const canAdvance = ["ASSIGNED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"].includes(
              currentStatus
            );

            return (
              <div
                key={mission.id}
                className="glass-panel rounded-2xl shadow-sm border border-border-subtle overflow-hidden transition-all hover:border-blue-500/40"
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-sky-500/15 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-bold">
                      <Truck className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400">
                          {mission.mission_code || `MSN-${mission.id.slice(0, 8).toUpperCase()}`}
                        </span>
                        {getStatusBadge(mission.status)}
                        <span className="text-[11px] text-text-tertiary font-mono">
                          {mission.vehicle_type || "Heavy Cargo Truck"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-text-primary font-semibold flex-wrap">
                        <span className="flex items-center gap-1 text-text-secondary">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          {mission.depot_name || mission.source_depot_name || "Regional Depot"}
                        </span>
                        <span className="text-text-tertiary">➔</span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          {mission.zone_identifier || mission.destination_label || "Affected Sector"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons & Telemetry */}
                  <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-border-subtle">
                    <div className="text-right text-xs space-y-0.5">
                      <div className="font-mono font-bold text-text-primary">
                        {mission.distance_km ? `${mission.distance_km} km` : "Corridor Route"}
                      </div>
                      <div className="text-[10px] text-text-tertiary">
                        {mission.est_duration_hours ? `ETA: ~${mission.est_duration_hours} hrs` : "Direct Haul"}
                      </div>
                    </div>

                    {canAdvance && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={updateStatusMutation.isPending}
                        onClick={() => handleAdvanceStatus(mission)}
                      >
                        {currentStatus === "ASSIGNED" && "Dispatch"}
                        {currentStatus === "DISPATCHED" && "In Transit"}
                        {currentStatus === "IN_TRANSIT" && "Mark Delivered"}
                        {currentStatus === "DELIVERED" && "Complete"}
                      </Button>
                    )}

                    <button
                      onClick={() =>
                        setExpandedMissionId(isExpanded ? null : mission.id)
                      }
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-secondary"
                      title={isExpanded ? "Collapse Details" : "View Manifest"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Manifest & Waypoints Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50/80 dark:bg-slate-900/60 p-4 sm:p-6 border-t border-border-subtle space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cargo Manifest */}
                      <div className="space-y-2">
                        <div className="font-bold text-text-primary flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-blue-500" />
                          <span>Cargo Manifest (Dispatched Supplies)</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800/60 rounded-xl p-3 border border-border-subtle space-y-2">
                          {mission.manifest && Object.keys(mission.manifest).length > 0 ? (
                            Object.entries(mission.manifest).map(([item, qty]) => (
                              <div
                                key={item}
                                className="flex items-center justify-between text-xs py-1 border-b border-border-subtle/50 last:border-none"
                              >
                                <span className="capitalize text-text-secondary font-medium">
                                  {item.replace(/_/g, " ")}
                                </span>
                                <span className="font-mono font-bold text-text-primary">
                                  {Number(qty).toLocaleString()} units
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-text-tertiary text-xs">Standard emergency relief payload.</div>
                          )}
                        </div>
                      </div>

                      {/* Dispatch & Personnel Info */}
                      <div className="space-y-2">
                        <div className="font-bold text-text-primary flex items-center gap-1.5">
                          <User className="w-4 h-4 text-blue-500" />
                          <span>Convoy & Route Metadata</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800/60 rounded-xl p-3 border border-border-subtle space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Team Leader:</span>
                            <span className="font-medium text-text-primary">
                              {mission.team_leader || "Field Operations Dispatch Lead"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Vehicle Identifier:</span>
                            <span className="font-mono text-text-primary">
                              {mission.vehicle_identifier || "FLEET-IND-404"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Registered:</span>
                            <span className="font-mono text-text-primary">
                              {new Date(mission.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {mission.notes && (
                            <div className="pt-1 text-[11px] text-text-secondary italic">
                              "{mission.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
