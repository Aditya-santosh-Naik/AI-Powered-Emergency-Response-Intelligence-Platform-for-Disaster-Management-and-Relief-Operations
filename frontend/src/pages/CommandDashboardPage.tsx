import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Truck,
  Shield,
  AlertTriangle,
  Play,
  RefreshCw,
  Zap,
  CheckCircle2,
  Sliders,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type {
  AllocationPlan,
  PriorityOverride,
  OperationsOverview,
  DisasterEvent,
} from "../types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Tooltip } from "../components/ui/Tooltip";
import { SkeletonKpi } from "../components/ui/SkeletonLoader";
import { ErrorState } from "../components/ui/ErrorState";

export const CommandDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Optimization Form States
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [planningHorizon, setPlanningHorizon] = useState<number>(3);
  const [enforceAccessibility, setEnforceAccessibility] = useState<boolean>(true);
  const [distancePenaltyWeight, setDistancePenaltyWeight] = useState<number>(0.0001);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Override Form States
  const [overridePredictionId, setOverridePredictionId] = useState<string>("");
  const [overrideUrgencyScore, setOverrideUrgencyScore] = useState<number>(90);
  const [overrideUrgencyClass, setOverrideUrgencyClass] = useState<string>("CRITICAL");
  const [overrideJustification, setOverrideJustification] = useState<string>("");

  // Queries
  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useQuery<OperationsOverview>({
    queryKey: ["operations-overview"],
    queryFn: api.getOperationsOverview,
    refetchInterval: 15000,
  });

  const { data: events = [] } = useQuery<DisasterEvent[]>({
    queryKey: ["events"],
    queryFn: () => api.getEvents({ limit: 50 }),
  });

  const { data: plans = [] } = useQuery<AllocationPlan[]>({
    queryKey: ["allocation-plans", selectedEventId],
    queryFn: () => api.getAllocationPlans(selectedEventId || undefined),
  });

  const { data: overrides = [], refetch: refetchOverrides } = useQuery<PriorityOverride[]>({
    queryKey: ["priority-overrides"],
    queryFn: api.listOverrides,
  });

  const activePlan = plans.length > 0 ? plans[0] : null;

  // Run Allocation Mutation
  const runAllocationMutation = useMutation({
    mutationFn: () =>
      api.runAllocation({
        event_id: selectedEventId || undefined,
        planning_horizon_days: planningHorizon,
        distance_penalty_weight: distancePenaltyWeight,
        enforce_accessibility: enforceAccessibility,
      }),
    onSuccess: (data) => {
      setActionSuccess(
        `Optimization completed successfully! Status: ${data.solver_status}. Satisfied: ${data.total_demand_satisfied_pct}%`
      );
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["allocation-plans"] });
      queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
    },
    onError: (err: any) => {
      setActionError(err.message || "Optimization solver run failed.");
      setActionSuccess(null);
    },
  });

  // Auto Create Missions Mutation
  const createMissionsMutation = useMutation({
    mutationFn: (planId: string) => api.autoCreateMissions(planId),
    onSuccess: (missions) => {
      setActionSuccess(`Successfully generated ${missions.length} relief dispatch missions!`);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to auto-generate dispatch missions.");
    },
  });

  // Create Override Mutation
  const createOverrideMutation = useMutation({
    mutationFn: () =>
      api.createOverride({
        prediction_id: overridePredictionId,
        overridden_urgency_score: overrideUrgencyScore,
        overridden_urgency_class: overrideUrgencyClass,
        justification: overrideJustification,
      }),
    onSuccess: () => {
      setActionSuccess("Priority override registered and active for subsequent solver runs.");
      setOverridePredictionId("");
      setOverrideJustification("");
      refetchOverrides();
      queryClient.invalidateQueries({ queryKey: ["priority-overrides"] });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to create commander priority override.");
    },
  });

  // Delete Override Mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: (overrideId: string) => api.deleteOverride(overrideId),
    onSuccess: () => {
      setActionSuccess("Priority override deactivated. Restored default ML urgency model.");
      refetchOverrides();
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to deactivate override.");
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in-up">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-sky-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            Operations Command & Logistics Routing Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Disaster Logistics Command Center
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-3xl leading-relaxed">
            Google OR-Tools MILP Linear Solver & NetworkX Logistics Dispatch Engine. Optimize depot supply
            allocations, manage commander priority overrides, and track multi-state relief missions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              refetchOverview();
              queryClient.invalidateQueries({ queryKey: ["allocation-plans"] });
            }}
          >
            Refresh Telemetry
          </Button>

          <Link to="/missions">
            <Button variant="primary" size="sm" icon={Truck}>
              Missions Board
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Alerts Banner ──────────────────────────────────────── */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <ErrorState
          title="Operation Encountered Error"
          message={actionError}
          onRetry={() => setActionError(null)}
        />
      )}

      {/* ── KPI Operational Overview Strip ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {overviewLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle">
              <div className="text-[11px] font-semibold text-text-tertiary">Active Alerts</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1">
                {overview?.active_alerts_count ?? 0}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-sky-400 mt-1 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Monitored Feeds
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle">
              <div className="text-[11px] font-semibold text-text-tertiary">Critical Events</div>
              <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                {overview?.critical_events_count ?? 0}
              </div>
              <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" /> High Hazard Score
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle">
              <div className="text-[11px] font-semibold text-text-tertiary">Priority Zones</div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {overview?.high_priority_zones_count ?? 0}
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Sectors Requiring Relief
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle">
              <div className="text-[11px] font-semibold text-text-tertiary">Active Depots</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {overview?.depots_active_count ?? 0}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                Logistics Trunk Hubs
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle">
              <div className="text-[11px] font-semibold text-text-tertiary">Food & Water Stock</div>
              <div className="text-xl font-bold font-mono text-text-primary mt-1">
                {((overview?.total_stock?.food_packets || 0) + (overview?.total_stock?.water || 0)).toLocaleString()}
              </div>
              <div className="text-[10px] text-text-tertiary mt-1 font-mono">
                Pkt: {(overview?.total_stock?.food_packets || 0).toLocaleString()}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle">
              <div className="text-[11px] font-semibold text-text-tertiary">Active Missions</div>
              <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {overview?.active_missions_count ?? 0}
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium flex items-center gap-1">
                <Truck className="w-3 h-3" /> Fleet In Transit
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Main Operations Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Optimization Controller & Override Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Optimization Controller Card */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-5 border border-border-subtle">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-sky-500/15 text-blue-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">OR-Tools MILP Solver</h2>
                  <p className="text-[11px] text-text-secondary">SCIP Optimization Engine</p>
                </div>
              </div>
              <Badge variant="info">Protocol MILP-2026</Badge>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Target Disaster Incident
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Active Disasters (Global Allocation)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.country || "India"}) - {ev.event_type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Planning Horizon
                  </label>
                  <select
                    value={planningHorizon}
                    onChange={(e) => setPlanningHorizon(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value={1}>1 Day (Immediate Surge)</option>
                    <option value={3}>3 Days (Operational Cycle)</option>
                    <option value={7}>7 Days (Sustained Corridor)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Transit Cost Penalty
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={distancePenaltyWeight}
                    onChange={(e) => setDistancePenaltyWeight(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-text-secondary hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={enforceAccessibility}
                    onChange={(e) => setEnforceAccessibility(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Degrade routing cost for cut-off / restricted road sectors</span>
                </label>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={Play}
                  loading={runAllocationMutation.isPending}
                  onClick={() => runAllocationMutation.mutate()}
                  className="w-full justify-center"
                >
                  Execute Resource Allocation Solver
                </Button>
              </div>
            </div>
          </div>

          {/* Commander Priority Override Card */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4 border border-border-subtle">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Commander Priority Override</h3>
                  <p className="text-[11px] text-text-secondary">Manual Zone Urgency Elevation</p>
                </div>
              </div>
              <Tooltip content="Allows emergency commanders to elevate zone priority over ML predictions">
                <Sliders className="w-4 h-4 text-text-tertiary cursor-help" />
              </Tooltip>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Demand Prediction ID (UUID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                  value={overridePredictionId}
                  onChange={(e) => setOverridePredictionId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Override Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={overrideUrgencyScore}
                    onChange={(e) => setOverrideUrgencyScore(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Urgency Tier
                  </label>
                  <select
                    value={overrideUrgencyClass}
                    onChange={(e) => setOverrideUrgencyClass(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="CRITICAL">CRITICAL (Top Queue)</option>
                    <option value="HIGH">HIGH (Elevated)</option>
                    <option value="MODERATE">MODERATE (Standard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Justification / Authority Directive
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Hospital flooded, 450 acute patients requiring evacuation supplies."
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={PlusCircle}
                loading={createOverrideMutation.isPending}
                disabled={!overridePredictionId.trim() || !overrideJustification.trim()}
                onClick={() => createOverrideMutation.mutate()}
                className="w-full justify-center"
              >
                Register Priority Override
              </Button>
            </div>

            {/* Active Overrides List */}
            {overrides.length > 0 && (
              <div className="pt-2 border-t border-border-subtle space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  Active Overrides ({overrides.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {overrides.map((ov) => (
                    <div
                      key={ov.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle text-xs flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-text-primary flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>{ov.zone_identifier || "Zone Override"}</span>
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                            [{ov.overridden_urgency_class}: {ov.overridden_urgency_score}]
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary line-clamp-1">
                          {ov.justification}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteOverrideMutation.mutate(ov.id)}
                        className="text-text-tertiary hover:text-red-500 p-1"
                        title="Deactivate override"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): Active Allocation Plan & Details */}
        <div className="lg:col-span-7 space-y-6">
          {activePlan ? (
            <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-6 border border-border-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-sky-400">
                      PLAN-{activePlan.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activePlan.solver_status === "OPTIMAL"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      }`}
                    >
                      {activePlan.solver_status || "FEASIBLE"}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-text-primary mt-1">
                    Optimal Resource Distribution Plan
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Truck}
                    loading={createMissionsMutation.isPending}
                    onClick={() => createMissionsMutation.mutate(activePlan.id)}
                  >
                    Auto-Generate Missions
                  </Button>
                </div>
              </div>

              {/* Plan Statistics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-subtle">
                  <div className="text-[10px] text-text-tertiary font-medium">Demand Fulfilled</div>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {activePlan.total_demand_satisfied_pct ?? 100}%
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-subtle">
                  <div className="text-[10px] text-text-tertiary font-medium">Solver Objective</div>
                  <div className="text-xl font-bold font-mono text-text-primary mt-0.5">
                    {activePlan.objective_value ? activePlan.objective_value.toFixed(1) : "0.0"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-subtle">
                  <div className="text-[10px] text-text-tertiary font-medium">Execution Latency</div>
                  <div className="text-xl font-bold font-mono text-text-primary mt-0.5">
                    {activePlan.execution_time_ms ? `${activePlan.execution_time_ms} ms` : "<15 ms"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-subtle">
                  <div className="text-[10px] text-text-tertiary font-medium">Allocation Routes</div>
                  <div className="text-xl font-bold font-mono text-blue-600 dark:text-sky-400 mt-0.5">
                    {activePlan.details?.length || 0}
                  </div>
                </div>
              </div>

              {/* Allocation Details Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                  <span>Logistics Allocation Breakdown</span>
                  <span className="text-[11px] text-text-tertiary font-normal">
                    Depot stock matched to disaster zone demand
                  </span>
                </div>

                <div className="overflow-x-auto border border-border-subtle rounded-xl max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-text-secondary sticky top-0 border-b border-border-subtle">
                      <tr>
                        <th className="p-2.5 font-semibold">Origin Depot</th>
                        <th className="p-2.5 font-semibold">Destination Zone</th>
                        <th className="p-2.5 font-semibold">Resource</th>
                        <th className="p-2.5 font-semibold text-right">Allocated</th>
                        <th className="p-2.5 font-semibold text-right">Demand</th>
                        <th className="p-2.5 font-semibold text-right">Shortage</th>
                        <th className="p-2.5 font-semibold">Transit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {activePlan.details && activePlan.details.length > 0 ? (
                        activePlan.details.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 font-medium text-text-primary">
                              {item.depot_name || item.source_depot_name || "Regional Depot"}
                            </td>
                            <td className="p-2.5 text-text-secondary">
                              {item.zone_identifier || item.zone_label || "Affected Sector"}
                            </td>
                            <td className="p-2.5 capitalize font-medium text-blue-600 dark:text-sky-400">
                              {item.resource_type.replace(/_/g, " ")}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {(item.allocated_quantity ?? item.allocated_qty ?? 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-mono text-text-secondary">
                              {(item.demanded_quantity ?? 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-mono">
                              {(item.shortage_quantity ?? 0) > 0 ? (
                                <span className="text-red-500 font-semibold">
                                  -{(item.shortage_quantity ?? 0).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-emerald-500">0</span>
                              )}
                            </td>
                            <td className="p-2.5 text-[11px] text-text-tertiary font-mono">
                              {item.distance_km ? `${item.distance_km} km` : "Local"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-text-tertiary">
                            No allocations recorded in this plan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center shadow-xl space-y-4 border border-border-subtle">
              <div className="w-12 h-12 bg-blue-100 dark:bg-sky-500/15 text-blue-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-text-primary">No Active Allocation Plan</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                Configure your planning horizon and operational constraints on the left, then click
                "Execute Resource Allocation Solver" to generate an optimized delivery schedule.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
