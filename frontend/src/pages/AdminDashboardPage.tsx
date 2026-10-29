import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  Play,
  Layers,
  MapPin,
  UserCheck,
  FileSpreadsheet,
  Cpu,
  RefreshCw,
  Droplets,
  HeartPulse,
  Home,
  Utensils,
  LogIn,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type {
  DisasterReport,
  DisasterReportReviewRequest,
  DisasterReportAssessmentResponse,
} from "../types";
import { Button } from "../components/ui/Button";
import { CopyableId } from "../components/ui/CopyableId";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";

export const AdminDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isAdmin, quickSwitchDemo } = useAuth();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [disasterTypeFilter, setDisasterTypeFilter] = useState<string>("ALL");

  // Selected report for review / prediction
  const [selectedReport, setSelectedReport] = useState<DisasterReport | null>(null);
  const [reviewDecision, setReviewDecision] = useState<string>("ACCEPTED_FOR_ASSESSMENT");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Prediction results state
  const [assessmentResult, setAssessmentResult] = useState<DisasterReportAssessmentResponse | null>(null);
  const [planningHorizon, setPlanningHorizon] = useState<number>(3);
  const [applyVulnBuffer, setApplyVulnBuffer] = useState<boolean>(false);

  // Queries
  const { data: reports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ["admin-reports", statusFilter, disasterTypeFilter],
    queryFn: () =>
      api.getAdminReports({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        disaster_type: disasterTypeFilter === "ALL" ? undefined : disasterTypeFilter,
      }),
    enabled: isAdmin,
  });

  const { data: modelStatus } = useQuery({
    queryKey: ["model-status"],
    queryFn: api.getModelStatus,
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DisasterReportReviewRequest }) =>
      api.reviewReport(id, data),
    onSuccess: (updatedReport) => {
      setSelectedReport(updatedReport);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to update report review decision");
    },
  });

  // Assess & Predict pipeline mutation
  const predictMutation = useMutation({
    mutationFn: ({ id, horizon, vuln }: { id: string; horizon: number; vuln: boolean }) =>
      api.assessReportAndPredict(id, horizon, vuln),
    onSuccess: (data) => {
      setAssessmentResult(data);
      setSelectedReport(data.report);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (err: any) => {
      setActionError(err.message || "Prediction pipeline execution failed");
    },
  });

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    reviewMutation.mutate({
      id: selectedReport.id,
      data: {
        status: reviewDecision,
        admin_notes: adminNotes.trim() || undefined,
      },
    });
  };

  const handleRunPredictor = () => {
    if (!selectedReport) return;
    predictMutation.mutate({
      id: selectedReport.id,
      horizon: planningHorizon,
      vuln: applyVulnBuffer,
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-qc-bg text-qc-text-primary p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-qc-surface-1 border border-qc-border-strong rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-qc-surface-2 border border-qc-border-strong text-qc-accent rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-qc-text-primary">Admin Clearance Required</h2>
          <p className="text-xs text-qc-text-secondary leading-relaxed">
            This dashboard is restricted to authorized Relief Coordinators and Command Center personnel with administrative role permissions.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              icon={LogIn}
              onClick={() => quickSwitchDemo("admin")}
              className="w-full"
            >
              Sign In as Command Admin (Demo)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-qc-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2 text-qc-accent text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-qc-accent" />
            Role B: Command Center Relief Coordinator
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-qc-text-primary">
            Incident Review & Prediction Command
          </h1>
          <p className="text-xs text-qc-text-secondary mt-1 max-w-2xl leading-relaxed">
            Review user-submitted disaster reports, confirm official impact zones, and execute the Weeks 3–4 Machine Learning Resource Demand Prediction Engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {modelStatus && (
            <div className="bg-qc-surface-1 border border-qc-border-subtle px-3.5 py-1.5 rounded-lg text-right">
              <div className="text-[10px] text-qc-text-tertiary font-mono uppercase">ML Engine Status</div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-end font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{modelStatus.service_status} ({modelStatus.model_version})</span>
              </div>
            </div>
          )}
          <a
            href={api.getExcelDownloadUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-qc-surface-1 hover:bg-qc-surface-2 text-qc-text-primary border border-qc-border-subtle hover:border-qc-border-strong rounded-lg text-xs font-medium transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel Dataset</span>
          </a>
        </div>
      </div>

      {actionError && (
        <ErrorState title="Action Failed" message={actionError} />
      )}

      {/* Main Layout: Reports Queue (Left) & Inspector / Predictor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Filterable Reports Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-qc-border-subtle">
              <div className="font-semibold text-qc-text-primary flex items-center gap-2 text-xs">
                <Layers className="w-4 h-4 text-qc-accent" />
                <span>Submitted Reports Queue</span>
              </div>
              <button
                onClick={() => refetchReports()}
                className="text-xs text-qc-text-tertiary hover:text-qc-text-primary flex items-center gap-1 transition"
                title="Refresh list"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[10px] font-mono text-qc-text-tertiary uppercase mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-2 py-1 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="ACCEPTED_FOR_ASSESSMENT">Accepted</option>
                  <option value="ADDITIONAL_INFO_REQUIRED">Need More Info</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-qc-text-tertiary uppercase mb-1">
                  Disaster Type
                </label>
                <select
                  value={disasterTypeFilter}
                  onChange={(e) => setDisasterTypeFilter(e.target.value)}
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-2 py-1 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                >
                  <option value="ALL">All Types</option>
                  <option value="flood">Flood</option>
                  <option value="cyclone">Cyclone</option>
                  <option value="earthquake">Earthquake</option>
                  <option value="landslide">Landslide</option>
                  <option value="wildfire">Wildfire</option>
                </select>
              </div>
            </div>

            {/* Queue List */}
            {reportsLoading ? (
              <div className="py-8 text-center text-xs text-qc-text-tertiary">
                Loading triage queue...
              </div>
            ) : reports.length === 0 ? (
              <EmptyState
                title="Queue Empty"
                description="No reports match the active filter criteria."
                illustration="reports"
              />
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {reports.map((report) => {
                  const isSelected = selectedReport?.id === report.id;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => {
                        setSelectedReport(report);
                        setAssessmentResult(null);
                        setAdminNotes(report.admin_notes || "");
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-qc-surface-2 border-qc-accent shadow-md shadow-sky-950/30"
                          : "bg-qc-surface-1 border-qc-border-subtle hover:border-qc-border-strong hover:bg-qc-surface-2/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-qc-accent">
                          {report.report_code}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                            report.status === "ACCEPTED_FOR_ASSESSMENT"
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/80"
                              : report.status === "REJECTED"
                              ? "bg-red-950/80 text-red-300 border border-red-700/80"
                              : report.status === "ADDITIONAL_INFO_REQUIRED"
                              ? "bg-sky-950/80 text-sky-300 border border-sky-700/80"
                              : "bg-amber-950/80 text-amber-300 border border-amber-700/80"
                          }`}
                        >
                          {report.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-qc-text-primary truncate">
                        {report.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-qc-text-tertiary">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-qc-accent" />
                          {report.location_name}
                        </span>
                        <span className="capitalize">{report.disaster_type}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Review Decisions & Predictor Execution (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedReport ? (
            <div className="space-y-6">
              {/* Detailed Report Card */}
              <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-qc-border-subtle pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CopyableId id={selectedReport.report_code} />
                      <span className="text-xs uppercase tracking-wider text-qc-text-tertiary font-mono">
                        {selectedReport.disaster_type}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-qc-text-primary mt-1.5">
                      {selectedReport.title}
                    </h2>
                  </div>
                  <div className="text-right text-xs text-qc-text-tertiary">
                    <div>Reporter: <span className="text-qc-text-secondary">{selectedReport.reporter_name || "Citizen"}</span></div>
                    <div className="font-mono text-[10px] text-qc-text-disabled">{selectedReport.reporter_email}</div>
                  </div>
                </div>

                <div className="text-xs text-qc-text-secondary leading-relaxed bg-qc-surface-2 p-3.5 rounded-xl border border-qc-border-subtle">
                  {selectedReport.description}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-qc-surface-2 rounded-lg border border-qc-border-subtle">
                    <div className="text-[10px] text-qc-text-tertiary font-mono">Coordinates</div>
                    <div className="font-mono font-semibold text-qc-text-primary mt-0.5 tabular-nums">
                      {selectedReport.latitude.toFixed(4)}, {selectedReport.longitude.toFixed(4)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-qc-surface-2 rounded-lg border border-qc-border-subtle">
                    <div className="text-[10px] text-qc-text-tertiary font-mono">Est Population</div>
                    <div className="font-semibold text-qc-text-primary mt-0.5 tabular-nums">
                      {selectedReport.estimated_affected_population?.toLocaleString() || "Not specified"}
                    </div>
                  </div>
                  <div className="p-2.5 bg-qc-surface-2 rounded-lg border border-qc-border-subtle">
                    <div className="text-[10px] text-qc-text-tertiary font-mono">Severity Score</div>
                    <div className="font-semibold text-amber-300 mt-0.5 tabular-nums">
                      {selectedReport.estimated_damage_severity?.toFixed(2) || "0.50 (Est)"}
                    </div>
                  </div>
                  <div className="p-2.5 bg-qc-surface-2 rounded-lg border border-qc-border-subtle">
                    <div className="text-[10px] text-qc-text-tertiary font-mono">Road Access</div>
                    <div className="font-semibold text-qc-text-primary mt-0.5">
                      {selectedReport.road_accessible === false ? "Cut Off" : "Accessible"}
                    </div>
                  </div>
                </div>

                {/* Review Action Form */}
                <form
                  onSubmit={handleReviewSubmit}
                  className="bg-qc-surface-2/60 border border-qc-border-subtle rounded-xl p-4 space-y-3"
                >
                  <div className="text-xs font-semibold text-qc-text-primary flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-qc-accent" />
                    <span>Coordinator Review Action</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                        reviewDecision === "ACCEPTED_FOR_ASSESSMENT"
                          ? "bg-emerald-950/60 border-emerald-600 text-emerald-200"
                          : "bg-qc-surface-1 border-qc-border-subtle text-qc-text-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="review_decision"
                        value="ACCEPTED_FOR_ASSESSMENT"
                        checked={reviewDecision === "ACCEPTED_FOR_ASSESSMENT"}
                        onChange={(e) => setReviewDecision(e.target.value)}
                        className="accent-emerald-500"
                      />
                      <span>Approve & Accept</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                        reviewDecision === "ADDITIONAL_INFO_REQUIRED"
                          ? "bg-sky-950/60 border-sky-600 text-sky-200"
                          : "bg-qc-surface-1 border-qc-border-subtle text-qc-text-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="review_decision"
                        value="ADDITIONAL_INFO_REQUIRED"
                        checked={reviewDecision === "ADDITIONAL_INFO_REQUIRED"}
                        onChange={(e) => setReviewDecision(e.target.value)}
                        className="accent-sky-500"
                      />
                      <span>Request Info</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                        reviewDecision === "REJECTED"
                          ? "bg-red-950/60 border-red-600 text-red-200"
                          : "bg-qc-surface-1 border-qc-border-subtle text-qc-text-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="review_decision"
                        value="REJECTED"
                        checked={reviewDecision === "REJECTED"}
                        onChange={(e) => setReviewDecision(e.target.value)}
                        className="accent-red-500"
                      />
                      <span>Reject Report</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] text-qc-text-tertiary mb-1">
                      Coordinator Decision Directives & Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Verified with District Disaster Management Authority; ready for ML estimation."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full bg-qc-surface-1 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      loading={reviewMutation.isPending}
                    >
                      Record Review Decision
                    </Button>
                  </div>
                </form>

                {/* Pipeline Execution Section (Only if accepted) */}
                {selectedReport.status === "ACCEPTED_FOR_ASSESSMENT" && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 via-qc-surface-1 to-sky-950/30 border border-emerald-600/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-qc-text-primary flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-emerald-400" />
                          Execute Resource Demand Predictor
                        </h3>
                        <p className="text-xs text-qc-text-secondary mt-0.5">
                          Runs trained ML models on verified zone parameters and matches against depot inventory.
                        </p>
                      </div>
                      <Button
                        variant="accent"
                        size="sm"
                        icon={Play}
                        loading={predictMutation.isPending}
                        onClick={handleRunPredictor}
                      >
                        Run Prediction Engine
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-qc-border-subtle">
                      <div>
                        <label className="block text-qc-text-tertiary mb-1 text-[11px]">
                          Planning Horizon
                        </label>
                        <select
                          value={planningHorizon}
                          onChange={(e) => setPlanningHorizon(parseInt(e.target.value, 10))}
                          className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md p-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent font-mono"
                        >
                          <option value={1}>1 Day (Immediate Surge)</option>
                          <option value={3}>3 Days (Standard Response Window)</option>
                          <option value={7}>7 Days (Extended Relief Horizon)</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 text-qc-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={applyVulnBuffer}
                            onChange={(e) => setApplyVulnBuffer(e.target.checked)}
                            className="rounded accent-emerald-500"
                          />
                          <span>Apply Vulnerability Safety Buffer (+15%)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Prediction Results Display */}
              {assessmentResult && assessmentResult.predictions.length > 0 && (
                <div className="bg-qc-surface-1 border border-emerald-600/60 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between border-b border-qc-border-subtle pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Inference Complete • Linked Event: {assessmentResult.associated_event_id.slice(0, 8)}...
                      </div>
                      <h3 className="text-base font-bold text-qc-text-primary mt-1">
                        4-Target Resource Demand Breakdown
                      </h3>
                      <p className="text-xs text-qc-text-secondary mt-0.5">
                        Predictions generated via trained ML regressor with 80% prediction interval.
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-qc-text-tertiary">
                      <div>Horizon: {assessmentResult.predictions[0]?.planning_horizon_days} Days</div>
                      <div className="text-emerald-400 font-bold">
                        v{assessmentResult.predictions[0]?.model_version}
                      </div>
                    </div>
                  </div>

                  {/* 4 Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Food Packets */}
                    <div className="p-3.5 rounded-xl bg-qc-surface-2 border border-qc-border-subtle space-y-2">
                      <div className="flex items-center justify-between text-xs text-qc-text-tertiary">
                        <span className="flex items-center gap-1.5 font-medium text-amber-300">
                          <Utensils className="w-4 h-4" /> Food Packets
                        </span>
                        <span className="font-mono text-[10px]">packets</span>
                      </div>
                      <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                        {assessmentResult.predictions[0]?.resource_demands?.food_packets?.predicted_demand?.toLocaleString() ?? 0}
                      </div>
                      <div className="text-xs text-qc-text-tertiary flex justify-between pt-1 border-t border-qc-border-subtle">
                        <span>Verified Stock:</span>
                        <span className="font-mono text-qc-text-secondary tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.food_packets?.verified_available_stock != null
                            ? assessmentResult.predictions[0].resource_demands.food_packets.verified_available_stock.toLocaleString()
                            : "Unknown"}
                        </span>
                      </div>
                      <div className="text-xs flex justify-between font-semibold">
                        <span className="text-red-400">Recommended Additional:</span>
                        <span className="font-mono text-red-400 tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.food_packets?.additional_quantity_recommended != null
                            ? assessmentResult.predictions[0].resource_demands.food_packets.additional_quantity_recommended.toLocaleString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Water Liters */}
                    <div className="p-3.5 rounded-xl bg-qc-surface-2 border border-qc-border-subtle space-y-2">
                      <div className="flex items-center justify-between text-xs text-qc-text-tertiary">
                        <span className="flex items-center gap-1.5 font-medium text-sky-400">
                          <Droplets className="w-4 h-4" /> Clean Water
                        </span>
                        <span className="font-mono text-[10px]">liters</span>
                      </div>
                      <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                        {assessmentResult.predictions[0]?.resource_demands?.water_liters?.predicted_demand?.toLocaleString() ?? 0}
                      </div>
                      <div className="text-xs text-qc-text-tertiary flex justify-between pt-1 border-t border-qc-border-subtle">
                        <span>Verified Stock:</span>
                        <span className="font-mono text-qc-text-secondary tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.water_liters?.verified_available_stock != null
                            ? assessmentResult.predictions[0].resource_demands.water_liters.verified_available_stock.toLocaleString()
                            : "Unknown"}
                        </span>
                      </div>
                      <div className="text-xs flex justify-between font-semibold">
                        <span className="text-red-400">Recommended Additional:</span>
                        <span className="font-mono text-red-400 tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.water_liters?.additional_quantity_recommended != null
                            ? assessmentResult.predictions[0].resource_demands.water_liters.additional_quantity_recommended.toLocaleString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Medical Kits */}
                    <div className="p-3.5 rounded-xl bg-qc-surface-2 border border-qc-border-subtle space-y-2">
                      <div className="flex items-center justify-between text-xs text-qc-text-tertiary">
                        <span className="flex items-center gap-1.5 font-medium text-pink-400">
                          <HeartPulse className="w-4 h-4" /> Medical Kits
                        </span>
                        <span className="font-mono text-[10px]">kits</span>
                      </div>
                      <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                        {assessmentResult.predictions[0]?.resource_demands?.medical_kits?.predicted_demand?.toLocaleString() ?? 0}
                      </div>
                      <div className="text-xs text-qc-text-tertiary flex justify-between pt-1 border-t border-qc-border-subtle">
                        <span>Verified Stock:</span>
                        <span className="font-mono text-qc-text-secondary tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.medical_kits?.verified_available_stock != null
                            ? assessmentResult.predictions[0].resource_demands.medical_kits.verified_available_stock.toLocaleString()
                            : "Unknown"}
                        </span>
                      </div>
                      <div className="text-xs flex justify-between font-semibold">
                        <span className="text-red-400">Recommended Additional:</span>
                        <span className="font-mono text-red-400 tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.medical_kits?.additional_quantity_recommended != null
                            ? assessmentResult.predictions[0].resource_demands.medical_kits.additional_quantity_recommended.toLocaleString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Shelter Spaces */}
                    <div className="p-3.5 rounded-xl bg-qc-surface-2 border border-qc-border-subtle space-y-2">
                      <div className="flex items-center justify-between text-xs text-qc-text-tertiary">
                        <span className="flex items-center gap-1.5 font-medium text-purple-400">
                          <Home className="w-4 h-4" /> Shelter Spaces
                        </span>
                        <span className="font-mono text-[10px]">spaces</span>
                      </div>
                      <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                        {assessmentResult.predictions[0]?.resource_demands?.shelter_spaces?.predicted_demand?.toLocaleString() ?? 0}
                      </div>
                      <div className="text-xs text-qc-text-tertiary flex justify-between pt-1 border-t border-qc-border-subtle">
                        <span>Verified Stock:</span>
                        <span className="font-mono text-qc-text-secondary tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.shelter_spaces?.verified_available_stock != null
                            ? assessmentResult.predictions[0].resource_demands.shelter_spaces.verified_available_stock.toLocaleString()
                            : "Unknown"}
                        </span>
                      </div>
                      <div className="text-xs flex justify-between font-semibold">
                        <span className="text-red-400">Recommended Additional:</span>
                        <span className="font-mono text-red-400 tabular-nums">
                          {assessmentResult.predictions[0]?.resource_demands?.shelter_spaces?.additional_quantity_recommended != null
                            ? assessmentResult.predictions[0].resource_demands.shelter_spaces.additional_quantity_recommended.toLocaleString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Notice & Provenance */}
                  <div className="p-3.5 rounded-xl bg-qc-surface-2 border border-qc-border-subtle text-xs space-y-1.5">
                    <div className="font-semibold text-qc-text-primary flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Provenance & Decision-Support Notice</span>
                    </div>
                    <p className="text-qc-text-secondary leading-relaxed text-[11px]">
                      {assessmentResult.predictions[0]?.prediction_uncertainty_note}
                    </p>
                    <div className="text-qc-text-tertiary text-[10px] font-mono pt-1">
                      Excel workbook `dataset/disaster_resource_demand_dataset.xlsx` synchronized with prediction run.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No Incident Report Selected"
              description="Select an incident report from the triage queue on the left to review submitted evidence, register a coordinator decision, or run the ML demand prediction pipeline."
              illustration="reports"
            />
          )}
        </div>
      </div>
    </div>
  );
};
