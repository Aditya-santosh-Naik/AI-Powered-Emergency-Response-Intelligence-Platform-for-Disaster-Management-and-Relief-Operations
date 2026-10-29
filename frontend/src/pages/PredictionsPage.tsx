import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Info,
  Heart,
  Droplets,
  Package,
  Home,
  BriefcaseMedical,
} from "lucide-react";
import { api } from "../api/client";
import type { ScenarioComparison } from "../types";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ProvenanceLabel } from "../components/ui/ProvenanceLabel";

export const PredictionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [planningHorizon, setPlanningHorizon] = useState<number>(3);
  const [applyVulnBuffer, setApplyVulnBuffer] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"predictions" | "scenarios" | "recalculate" | "evaluation">("predictions");

  // Scenario Simulator state
  const [scenarioName, setScenarioName] = useState<string>("Slower Response Logistics Delay");
  const [popMultiplier, setPopMultiplier] = useState<number>(1.25);
  const [severityDelta, setSeverityDelta] = useState<number>(0.15);
  const [scenarioHorizon, setScenarioHorizon] = useState<number>(5);
  const [delayDelta, setDelayDelta] = useState<number>(24.0);
  const [inventoryMult, setInventoryMult] = useState<number>(0.8);
  const [simulatedResult, setSimulatedResult] = useState<ScenarioComparison | null>(null);

  // Dynamic Recalculation state
  const [recalcTrigger, setRecalcTrigger] = useState<string>("field_report");
  const [recalcSource, setRecalcSource] = useState<string>("NDRF District SitRep #4");
  const [recalcNotes, setRecalcNotes] = useState<string>("Field reconnaissance reports water levels receding in Zone 1, road block on National Highway NH-27.");
  const [recalcSuccessMsg, setRecalcSuccessMsg] = useState<string | null>(null);

  // Queries
  const { data: statusData } = useQuery({
    queryKey: ["prediction-status"],
    queryFn: api.getModelStatus,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents({ limit: 50 }),
  });

  // Set default selected event if none is selected
  const activeEventId = selectedEventId || (events.length > 0 ? events[0].id : "");

  const { data: predictions = [], isLoading: predLoading, refetch: refetchPredictions } = useQuery({
    queryKey: ["event-predictions", activeEventId, planningHorizon, applyVulnBuffer],
    queryFn: () => (activeEventId ? api.predictEventResources(activeEventId, planningHorizon, applyVulnBuffer) : []),
    enabled: !!activeEventId,
  });

  // Scenario simulation mutation
  const scenarioMutation = useMutation({
    mutationFn: () => {
      const currentZone = predictions.length > 0 ? {
        disaster_type: predictions[0].disaster_type,
        affected_population_estimate: predictions[0].affected_population_estimate,
        severity_score_0_1: predictions[0].severity_score_0_1,
        building_damage_share_0_1: predictions[0].building_damage_share_0_1,
        road_accessibility_0_1: predictions[0].road_accessibility_0_1,
        planning_horizon_days: planningHorizon,
      } : undefined;

      return api.simulateScenario({
        zone_data: currentZone,
        scenario_name: scenarioName,
        population_multiplier: popMultiplier,
        severity_score_delta: severityDelta,
        planning_horizon_days: scenarioHorizon,
        response_delay_hours_delta: delayDelta,
        inventory_availability_multiplier: inventoryMult,
        apply_vulnerability_buffer: applyVulnBuffer,
      });
    },
    onSuccess: (data) => {
      setSimulatedResult(data);
    },
  });

  // Recalculate mutation
  const recalcMutation = useMutation({
    mutationFn: () =>
      api.recalculateEventDemand(activeEventId, {
        trigger_type: recalcTrigger,
        source_reference: recalcSource,
        notes: recalcNotes,
      }),
    onSuccess: (data) => {
      setRecalcSuccessMsg(`Recalculation successful! Updated ${data.zones_updated_count} zones.`);
      queryClient.invalidateQueries({ queryKey: ["event-predictions", activeEventId] });
      refetchPredictions();
      setTimeout(() => setRecalcSuccessMsg(null), 6000);
    },
  });

  // Refresh Excel mutation
  const excelRefreshMutation = useMutation({
    mutationFn: api.refreshExcelWorkbook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prediction-status"] });
    },
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL_URGENT":
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-950/80 border border-red-700/80 text-red-300 font-mono">▲ CRITICAL URGENT</span>;
      case "HIGH_PRIORITY":
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-orange-950/80 border border-orange-700/80 text-orange-300 font-mono">◆ HIGH PRIORITY</span>;
      case "MODERATE":
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-950/80 border border-amber-700/80 text-amber-300 font-mono">■ MODERATE</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-qc-surface-2 border border-qc-border-subtle text-qc-text-secondary font-mono">● LOW MONITORING</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-qc-text-primary">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-qc-border-subtle">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-800/80 flex items-center justify-center text-qc-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-qc-text-primary">
              Resource Demand Prediction Engine
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-qc-surface-2 text-qc-text-secondary border border-qc-border-subtle">
              WEEKS 3–4
            </span>
          </div>
          <p className="text-xs text-qc-text-secondary max-w-2xl leading-relaxed">
            Multi-target supervised regression (Gradient Boosting quantile ensembles) predicting Food Packets, Clean Water, Medical Kits, and Shelter Spaces with 80% nominal intervals.
          </p>
        </div>

        {/* Excel Dataset Actions */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={excelRefreshMutation.isPending}
            onClick={() => excelRefreshMutation.mutate()}
            title="Reproducibly regenerate disaster_resource_demand_dataset.xlsx"
          >
            Refresh Excel
          </Button>

          <a
            href={api.getExcelDownloadUrl()}
            download="disaster_resource_demand_dataset.xlsx"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Download Dataset (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Provenance & Critical Honesty Banner */}
      <div className="bg-amber-950/20 border border-amber-800/60 rounded-xl p-4 flex items-start space-x-3.5">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 font-sans">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-amber-300 uppercase tracking-wide text-[11px] font-mono">
              Data Provenance & Operational Notice
            </span>
            <ProvenanceLabel type="synthetic" sourceName="Calibrated Simulation" />
          </div>
          <p className="text-qc-text-secondary leading-relaxed">
            Initial training data utilizes calibrated synthetic demonstration records (2,500 zone records across 250 simulated events). <strong className="text-amber-200">Low error on synthetic data does not establish operational reliability in uncalibrated real-world terrain.</strong> Predictions are advisory decision-support estimates for coordinator review, not automatic dispatch orders.
          </p>
        </div>
      </div>

      {/* Model & Workbook Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-3.5">
          <div className="flex items-center justify-between text-qc-text-tertiary mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Engine Version</span>
            <Sparkles className="h-3.5 w-3.5 text-qc-accent" />
          </div>
          <div className="text-base font-bold font-mono text-qc-text-primary">
            {statusData?.model_version || "v1.2.0-ensemble-quantile"}
          </div>
          <div className="text-[11px] text-qc-text-tertiary mt-1 flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>4 Quantile Regressors</span>
          </div>
        </div>

        <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-3.5">
          <div className="flex items-center justify-between text-qc-text-tertiary mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Training Split</span>
            <Layers className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="text-base font-bold font-mono text-qc-text-primary">2,000 Train / 500 Test</div>
          <div className="text-[11px] text-qc-text-tertiary mt-1">GroupShuffleSplit 80/20</div>
        </div>

        <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-3.5">
          <div className="flex items-center justify-between text-qc-text-tertiary mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Prediction Bounds</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-qc-text-primary">80% Nominal Quantile</div>
          <div className="text-[11px] text-qc-text-tertiary mt-1">10th – 90th Percentile Bounds</div>
        </div>

        <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-3.5">
          <div className="flex items-center justify-between text-qc-text-tertiary mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Excel Workbook</span>
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-qc-text-primary tabular-nums">
            {statusData?.excel_workbook_size_bytes ? `${Math.round(statusData.excel_workbook_size_bytes / 1024)} KB` : "418 KB"}
          </div>
          <div className="text-[11px] text-qc-text-tertiary mt-1 truncate">
            8 Tabular Worksheets
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-qc-border-subtle pb-px">
        {[
          { id: "predictions", label: "Zone Demand Predictions" },
          { id: "scenarios", label: "What-If Scenario Simulation" },
          { id: "recalculate", label: "Controlled Dynamic Recalculation" },
          { id: "evaluation", label: "Model Evaluation & Baselines" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2.5 px-3.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-qc-accent text-qc-accent font-semibold"
                : "border-transparent text-qc-text-secondary hover:text-qc-text-primary hover:border-qc-border-strong"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PREDICTIONS */}
      {activeTab === "predictions" && (
        <div className="space-y-6">
          {/* Controls Bar: Event Selector & Horizon */}
          <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <label className="block text-[11px] font-mono text-qc-text-tertiary uppercase mb-1">
                  Active Disaster Event
                </label>
                <select
                  value={activeEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="bg-qc-surface-2 border border-qc-border-subtle text-qc-text-primary rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-qc-accent max-w-sm truncate"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-qc-surface-2">
                      {ev.title} ({ev.event_type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-qc-text-tertiary uppercase mb-1">
                  Planning Horizon
                </label>
                <div className="flex items-center space-x-1">
                  {[1, 3, 5, 7].map((days) => (
                    <button
                      key={days}
                      onClick={() => setPlanningHorizon(days)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                        planningHorizon === days
                          ? "bg-qc-accent text-qc-accent-contrast font-bold shadow-sm"
                          : "bg-qc-surface-2 text-qc-text-secondary hover:text-qc-text-primary border border-qc-border-subtle"
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-xs text-qc-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyVulnBuffer}
                  onChange={(e) => setApplyVulnBuffer(e.target.checked)}
                  className="rounded border-qc-border-subtle text-qc-accent focus:ring-0 bg-qc-surface-2 h-4 w-4"
                />
                <span>Apply Vulnerability Safety Buffer (+15%)</span>
              </label>

              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                loading={predLoading}
                onClick={() => refetchPredictions()}
              >
                Run Inference
              </Button>
            </div>
          </div>

          {/* Predictions Display */}
          {predLoading ? (
            <div className="p-12 text-center text-xs text-qc-text-tertiary">
              Executing quantile model inference...
            </div>
          ) : predictions.length === 0 ? (
            <EmptyState
              title="No Predictions Found For Event"
              description="Click 'Run Inference' above to compute resource demand across affected impact zones."
              illustration="predictions"
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => refetchPredictions()}
                >
                  Generate Predictions Now
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {predictions.map((pred, pIdx) => {
                const demands = pred.resource_demands;
                return (
                  <div
                    key={pred.id || pIdx}
                    className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl overflow-hidden shadow-lg"
                  >
                    {/* Zone Header */}
                    <div className="bg-qc-surface-2/70 px-6 py-4 border-b border-qc-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-sm font-bold text-qc-text-primary">
                            {pred.zone_id}
                          </span>
                          {getUrgencyBadge(pred.urgency_class)}
                          <span className="text-xs text-qc-text-tertiary font-mono">
                            Urgency: <strong className="text-qc-text-primary">{pred.urgency_score_0_100}/100</strong>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-qc-text-tertiary mt-1.5 font-mono">
                          <span>Exposed Pop: <strong className="text-qc-text-primary tabular-nums">{pred.affected_population_estimate.toLocaleString()}</strong></span>
                          <span>Severity: <strong className="text-qc-text-primary tabular-nums">{pred.severity_score_0_1}</strong></span>
                          <span>Road Access: <strong className="text-qc-text-primary tabular-nums">{Math.round(pred.road_accessibility_0_1 * 100)}%</strong></span>
                          <span>Building Damage: <strong className="text-qc-text-primary tabular-nums">{Math.round(pred.building_damage_share_0_1 * 100)}%</strong></span>
                          <span>Horizon: <strong className="text-qc-accent">{pred.planning_horizon_days} Days</strong></span>
                        </div>
                      </div>

                      {/* Urgency Explanation */}
                      <div className="text-xs text-qc-text-secondary max-w-md bg-qc-surface-1 p-2.5 rounded-lg border border-qc-border-subtle leading-relaxed">
                        <strong className="text-amber-300">Urgency Drivers:</strong> {pred.urgency_reasons.join(" • ")}
                      </div>
                    </div>

                    {/* 4 Mandatory Target Resource Demand Cards */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Food Packets */}
                      <div className="bg-qc-surface-2/60 border border-qc-border-subtle rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-amber-300 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 font-sans">
                              <Package className="h-4 w-4" />
                              <span>Food Packets</span>
                            </span>
                            <span className="text-[10px] font-mono bg-qc-surface-1 px-1.5 py-0.5 rounded text-qc-text-tertiary border border-qc-border-subtle">
                              {demands.food_packets?.unit || "packets"}
                            </span>
                          </div>
                          <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                            {demands.food_packets?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-qc-text-tertiary mt-1 font-mono tabular-nums">
                            80% Interval: [{demands.food_packets?.lower_bound_80pct?.toLocaleString()} – {demands.food_packets?.upper_bound_80pct?.toLocaleString()}]
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-qc-border-subtle text-xs space-y-1">
                          <div className="flex justify-between text-qc-text-tertiary">
                            <span>Depot Stock:</span>
                            <span className="font-mono text-qc-text-primary tabular-nums">
                              {demands.food_packets?.verified_available_stock !== null ? demands.food_packets?.verified_available_stock?.toLocaleString() : "Unverified"}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-red-400">Shortage / Need:</span>
                            <span className="font-mono text-red-400 tabular-nums">
                              +{demands.food_packets?.additional_quantity_recommended?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Clean Water */}
                      <div className="bg-qc-surface-2/60 border border-qc-border-subtle rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-sky-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 font-sans">
                              <Droplets className="h-4 w-4" />
                              <span>Clean Water</span>
                            </span>
                            <span className="text-[10px] font-mono bg-qc-surface-1 px-1.5 py-0.5 rounded text-qc-text-tertiary border border-qc-border-subtle">
                              {demands.water_liters?.unit || "liters"}
                            </span>
                          </div>
                          <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                            {demands.water_liters?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-qc-text-tertiary mt-1 font-mono tabular-nums">
                            80% Interval: [{demands.water_liters?.lower_bound_80pct?.toLocaleString()} – {demands.water_liters?.upper_bound_80pct?.toLocaleString()}]
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-qc-border-subtle text-xs space-y-1">
                          <div className="flex justify-between text-qc-text-tertiary">
                            <span>Depot Stock:</span>
                            <span className="font-mono text-qc-text-primary tabular-nums">
                              {demands.water_liters?.verified_available_stock !== null ? demands.water_liters?.verified_available_stock?.toLocaleString() : "Unverified"}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-red-400">Shortage / Need:</span>
                            <span className="font-mono text-red-400 tabular-nums">
                              +{demands.water_liters?.additional_quantity_recommended?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Medical Kits */}
                      <div className="bg-qc-surface-2/60 border border-qc-border-subtle rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-pink-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 font-sans">
                              <BriefcaseMedical className="h-4 w-4" />
                              <span>Medical Kits</span>
                            </span>
                            <span className="text-[10px] font-mono bg-qc-surface-1 px-1.5 py-0.5 rounded text-qc-text-tertiary border border-qc-border-subtle">
                              {demands.medical_kits?.unit || "kits"}
                            </span>
                          </div>
                          <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                            {demands.medical_kits?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-qc-text-tertiary mt-1 font-mono tabular-nums">
                            80% Interval: [{demands.medical_kits?.lower_bound_80pct?.toLocaleString()} – {demands.medical_kits?.upper_bound_80pct?.toLocaleString()}]
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-qc-border-subtle text-xs space-y-1">
                          <div className="flex justify-between text-qc-text-tertiary">
                            <span>Depot Stock:</span>
                            <span className="font-mono text-qc-text-primary tabular-nums">
                              {demands.medical_kits?.verified_available_stock !== null ? demands.medical_kits?.verified_available_stock?.toLocaleString() : "Unverified"}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-red-400">Shortage / Need:</span>
                            <span className="font-mono text-red-400 tabular-nums">
                              +{demands.medical_kits?.additional_quantity_recommended?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Shelter Spaces */}
                      <div className="bg-qc-surface-2/60 border border-qc-border-subtle rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-purple-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 font-sans">
                              <Home className="h-4 w-4" />
                              <span>Shelter Spaces</span>
                            </span>
                            <span className="text-[10px] font-mono bg-qc-surface-1 px-1.5 py-0.5 rounded text-qc-text-tertiary border border-qc-border-subtle">
                              {demands.shelter_spaces?.unit || "spaces"}
                            </span>
                          </div>
                          <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                            {demands.shelter_spaces?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-qc-text-tertiary mt-1 font-mono tabular-nums">
                            80% Interval: [{demands.shelter_spaces?.lower_bound_80pct?.toLocaleString()} – {demands.shelter_spaces?.upper_bound_80pct?.toLocaleString()}]
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-qc-border-subtle text-xs space-y-1">
                          <div className="flex justify-between text-qc-text-tertiary">
                            <span>Depot Stock:</span>
                            <span className="font-mono text-qc-text-primary tabular-nums">
                              {demands.shelter_spaces?.verified_available_stock !== null ? demands.shelter_spaces?.verified_available_stock?.toLocaleString() : "Unverified"}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-red-400">Shortage / Need:</span>
                            <span className="font-mono text-red-400 tabular-nums">
                              +{demands.shelter_spaces?.additional_quantity_recommended?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vulnerability Explanation Section */}
                    {pred.vulnerability_profile && (
                      <div className="px-6 py-4 bg-qc-surface-2/30 border-t border-qc-border-subtle text-xs">
                        <div className="flex items-center space-x-2 text-qc-text-primary font-medium mb-2">
                          <Heart className="h-3.5 w-3.5 text-pink-400" />
                          <span>Demographic Vulnerability Profile (Sphere & WHO Standards)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-qc-text-secondary">
                          <div className="bg-qc-surface-1 p-3 rounded-lg border border-qc-border-subtle">
                            <span className="text-qc-text-primary block font-semibold mb-0.5 font-mono">
                              Children Share: {Math.round(pred.vulnerability_profile.children_share * 100)}%
                            </span>
                            <span className="text-[11px] text-qc-text-tertiary">
                              Pediatric hydration buffer & nutritional rations prioritized.
                            </span>
                          </div>
                          <div className="bg-qc-surface-1 p-3 rounded-lg border border-qc-border-subtle">
                            <span className="text-qc-text-primary block font-semibold mb-0.5 font-mono">
                              Elderly Share: {Math.round(pred.vulnerability_profile.elderly_share * 100)}%
                            </span>
                            <span className="text-[11px] text-qc-text-tertiary">
                              Accessible evacuation spaces and mobility provisions allocated.
                            </span>
                          </div>
                          <div className="bg-qc-surface-1 p-3 rounded-lg border border-qc-border-subtle">
                            <span className="text-qc-text-primary block font-semibold mb-0.5 font-mono">
                              Medical Dependency: {Math.round(pred.vulnerability_profile.medical_dependency_share * 100)}%
                            </span>
                            <span className="text-[11px] text-qc-text-tertiary">
                              Trauma relief kits and cold-chain refrigeration prioritized.
                            </span>
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
      )}

      {/* TAB 2: SCENARIOS */}
      {activeTab === "scenarios" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scenario Modifiers Panel */}
          <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-5 space-y-4">
            <div>
              <div className="flex items-center space-x-2 text-qc-text-primary font-bold text-sm mb-1">
                <Sliders className="h-4 w-4 text-qc-accent" />
                <h2>Scenario Assumptions</h2>
              </div>
              <p className="text-xs text-qc-text-secondary leading-relaxed">
                Adjust operational parameters to evaluate what-if impact on total resource demand and shortages.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-qc-text-tertiary uppercase mb-1">
                Scenario Identifier / Name
              </label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-qc-text-secondary mb-1">
                <span>Affected Population Shift</span>
                <span className="font-mono text-qc-accent">{Math.round((popMultiplier - 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={popMultiplier}
                onChange={(e) => setPopMultiplier(parseFloat(e.target.value))}
                className="w-full accent-qc-accent"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-qc-text-secondary mb-1">
                <span>Severity Score Adjustment</span>
                <span className="font-mono text-qc-accent">{severityDelta > 0 ? `+${severityDelta}` : severityDelta}</span>
              </div>
              <input
                type="range"
                min="-0.3"
                max="0.4"
                step="0.05"
                value={severityDelta}
                onChange={(e) => setSeverityDelta(parseFloat(e.target.value))}
                className="w-full accent-qc-accent"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-qc-text-secondary mb-1">
                <span>Response Delay Hours</span>
                <span className="font-mono text-qc-accent">+{delayDelta} hrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="72"
                step="6"
                value={delayDelta}
                onChange={(e) => setDelayDelta(parseFloat(e.target.value))}
                className="w-full accent-qc-accent"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-qc-text-secondary mb-1">
                <span>Planning Horizon</span>
                <span className="font-mono text-qc-accent">{scenarioHorizon} Days</span>
              </div>
              <input
                type="range"
                min="1"
                max="14"
                step="1"
                value={scenarioHorizon}
                onChange={(e) => setScenarioHorizon(parseInt(e.target.value, 10))}
                className="w-full accent-qc-accent"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-qc-text-secondary mb-1">
                <span>Inventory Availability Rate</span>
                <span className="font-mono text-qc-accent">{Math.round(inventoryMult * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={inventoryMult}
                onChange={(e) => setInventoryMult(parseFloat(e.target.value))}
                className="w-full accent-qc-accent"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              loading={scenarioMutation.isPending}
              onClick={() => scenarioMutation.mutate()}
              className="w-full"
            >
              Run Scenario Simulation
            </Button>
          </div>

          {/* Scenario Results Comparison */}
          <div className="lg:col-span-2 space-y-6">
            {!simulatedResult ? (
              <EmptyState
                title="No Simulation Executed"
                description="Adjust operational parameters on the left and click 'Run Scenario Simulation' to compare baseline vs. alternative demand shifts."
                illustration="predictions"
              />
            ) : (
              <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-6 space-y-6 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-qc-border-subtle">
                  <div>
                    <h3 className="text-base font-bold text-qc-text-primary">
                      {simulatedResult.scenario_name}
                    </h3>
                    <p className="text-xs text-qc-accent mt-0.5">
                      {simulatedResult.drivers_narrative}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono bg-qc-surface-2 px-2 py-0.5 rounded text-qc-text-tertiary border border-qc-border-subtle">
                    {simulatedResult.scenario_id}
                  </span>
                </div>

                {/* Comparative Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-qc-border-subtle text-qc-text-tertiary uppercase text-[10px] font-mono">
                        <th className="pb-3 font-semibold">Resource</th>
                        <th className="pb-3 font-semibold">Baseline Demand</th>
                        <th className="pb-3 font-semibold">Scenario Demand</th>
                        <th className="pb-3 font-semibold">Demand Shift</th>
                        <th className="pb-3 font-semibold">Calculated Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-qc-border-subtle/70 font-mono">
                      {Object.entries(simulatedResult.comparisons).map(([k, comp]) => (
                        <tr key={k} className="hover:bg-qc-surface-2/40">
                          <td className="py-3 font-sans font-medium text-qc-text-primary">
                            {comp.display_name}
                          </td>
                          <td className="py-3 text-qc-text-secondary tabular-nums">
                            {comp.baseline_demand.toLocaleString()} {comp.unit}
                          </td>
                          <td className="py-3 font-bold text-qc-text-primary tabular-nums">
                            {comp.scenario_demand.toLocaleString()} {comp.unit}
                          </td>
                          <td className={`py-3 font-semibold tabular-nums ${comp.demand_difference >= 0 ? "text-amber-400" : "text-emerald-400"}`}>
                            {comp.demand_difference >= 0 ? `+${comp.demand_difference.toLocaleString()}` : comp.demand_difference.toLocaleString()} ({comp.demand_difference_pct}%)
                          </td>
                          <td className="py-3 text-red-400 font-bold tabular-nums">
                            {comp.scenario_shortage != null ? comp.scenario_shortage.toLocaleString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Safety Notice */}
                <div className="bg-qc-surface-2/60 p-3.5 rounded-lg border border-qc-border-subtle text-xs text-qc-text-secondary leading-relaxed">
                  <strong className="text-qc-text-primary">Operational Integrity Notice:</strong> {simulatedResult.operational_integrity_notice}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DYNAMIC RECALCULATION */}
      {activeTab === "recalculate" && (
        <div className="max-w-3xl bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-6 space-y-6 shadow-xl">
          <div>
            <div className="flex items-center space-x-2 text-qc-text-primary font-bold text-sm mb-1">
              <RefreshCw className="h-4 w-4 text-qc-accent" />
              <h2>Controlled Dynamic Demand Recalculation</h2>
            </div>
            <p className="text-xs text-qc-text-secondary leading-relaxed">
              Trigger updated inference when verified field situation reports, damage reassessments, or road status updates are logged.
            </p>
          </div>

          {recalcSuccessMsg && (
            <div className="bg-emerald-950/60 border border-emerald-700/80 text-emerald-300 p-3 rounded-lg text-xs flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{recalcSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-qc-text-secondary mb-1">Trigger Type</label>
              <select
                value={recalcTrigger}
                onChange={(e) => setRecalcTrigger(e.target.value)}
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
              >
                <option value="field_report">Field Situation Report (SitRep)</option>
                <option value="boundary_update">Hazard Extent / Flood Boundary Shift</option>
                <option value="road_inaccessibility">Road Inaccessibility / Infrastructure Failure</option>
                <option value="inventory_reconciliation">Depot Inventory Reconciliation / Supply Influx</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-qc-text-secondary mb-1">
                Source Reference / Authorization Code
              </label>
              <input
                type="text"
                value={recalcSource}
                onChange={(e) => setRecalcSource(e.target.value)}
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-qc-text-secondary mb-1">
                Field Observations & Justification
              </label>
              <textarea
                rows={3}
                value={recalcNotes}
                onChange={(e) => setRecalcNotes(e.target.value)}
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent leading-relaxed"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              icon={RefreshCw}
              loading={recalcMutation.isPending}
              onClick={() => recalcMutation.mutate()}
            >
              Execute Controlled Recalculation
            </Button>
          </div>
        </div>
      )}

      {/* TAB 4: EVALUATION */}
      {activeTab === "evaluation" && (
        <div className="space-y-6">
          <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-6 shadow-xl">
            <h2 className="text-sm font-bold text-qc-text-primary mb-1">
              Model Training & Benchmark Performance
            </h2>
            <p className="text-xs text-qc-text-secondary mb-4">
              Honest validation metrics computed on held-out test events (GroupShuffleSplit 80/20) and compared against Sphere heuristic baselines.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-qc-border-subtle text-qc-text-tertiary uppercase text-[10px] font-mono">
                    <th className="pb-3 font-semibold">Target Variable</th>
                    <th className="pb-3 font-semibold">Model Name</th>
                    <th className="pb-3 font-semibold">Test MAE</th>
                    <th className="pb-3 font-semibold">Test RMSE</th>
                    <th className="pb-3 font-semibold">Test R²</th>
                    <th className="pb-3 font-semibold">Heuristic Baseline MAE</th>
                    <th className="pb-3 font-semibold">MAE Improvement</th>
                    <th className="pb-3 font-semibold">80% Interval Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-qc-border-subtle/70 font-mono">
                  {statusData?.evaluations && Object.entries(statusData.evaluations).map(([k, ev]) => (
                    <tr key={k} className="hover:bg-qc-surface-2/40">
                      <td className="py-3 font-sans font-medium text-qc-text-primary">{k}</td>
                      <td className="py-3 font-sans text-qc-text-tertiary">{ev.model_name || "GradientBoosting"}</td>
                      <td className="py-3 font-bold text-emerald-400 tabular-nums">{ev.mae?.toLocaleString()}</td>
                      <td className="py-3 text-qc-text-secondary tabular-nums">{ev.rmse?.toLocaleString()}</td>
                      <td className="py-3 text-qc-accent tabular-nums">{ev.r2}</td>
                      <td className="py-3 text-qc-text-tertiary tabular-nums">{ev.baseline_heuristic_mae?.toLocaleString()}</td>
                      <td className="py-3 font-semibold text-emerald-400 tabular-nums">+{ev.mae_improvement_pct}%</td>
                      <td className="py-3 text-sky-300 font-semibold tabular-nums">{ev.test_interval_coverage_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
