import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  Info,
  Layers,
  LogIn,
  X,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { DisasterReportCreate, DisasterReport } from "../types";
import { Button } from "../components/ui/Button";
import { CopyableId } from "../components/ui/CopyableId";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";

const LOCATION_PRESETS = [
  { name: "Guwahati, Assam (Brahmaputra Valley)", lat: 26.1445, lon: 91.7362 },
  { name: "Bhubaneswar, Odisha (Coastal Belt)", lat: 20.2961, lon: 85.8245 },
  { name: "Kalimpong, West Bengal (Teesta Hill Range)", lat: 27.0600, lon: 88.4700 },
  { name: "Kochi, Kerala (Vembanad Lowlands)", lat: 9.9312, lon: 76.2673 },
  { name: "Mumbai, Maharashtra (Western Coastline)", lat: 19.0760, lon: 72.8777 },
];

export const ReportDisasterPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, quickSwitchDemo } = useAuth();

  // Form states
  const [disasterType, setDisasterType] = useState<string>("flood");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<string>("26.1445");
  const [longitude, setLongitude] = useState<string>("91.7362");
  const [occurredAt, setOccurredAt] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [affectedPop, setAffectedPop] = useState<string>("5000");
  const [damageSeverity, setDamageSeverity] = useState<number>(0.6);
  const [roadAccessible, setRoadAccessible] = useState<boolean>(true);
  const [evidenceUrl, setEvidenceUrl] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<DisasterReport | null>(null);

  // Fetch reports submitted by the current user
  const { data: myReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["my-reports", user?.id],
    queryFn: api.getMyReports,
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: DisasterReportCreate) => api.submitReport(payload),
    onSuccess: (newReport) => {
      setSubmittedReport(newReport);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      // Reset non-location inputs
      setTitle("");
      setDescription("");
      setEvidenceUrl("");
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to submit disaster report");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError("You must sign in to submit a disaster report.");
      return;
    }

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError("Latitude must be a valid number between -90 and 90 degrees.");
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setFormError("Longitude must be a valid number between -180 and 180 degrees.");
      return;
    }

    if (!title.trim() || !locationName.trim() || !description.trim()) {
      setFormError("Title, location name, and description are required.");
      return;
    }

    const payload: DisasterReportCreate = {
      disaster_type: disasterType,
      title: title.trim(),
      description: description.trim(),
      location_name: locationName.trim(),
      latitude: latNum,
      longitude: lonNum,
      occurred_at: new Date(occurredAt).toISOString(),
      estimated_affected_population: affectedPop ? parseInt(affectedPop, 10) : undefined,
      estimated_damage_severity: damageSeverity,
      road_accessible: roadAccessible,
      supporting_evidence_url: evidenceUrl.trim() || undefined,
    };

    submitMutation.mutate(payload);
  };

  const selectPreset = (preset: { name: string; lat: number; lon: number }) => {
    setLocationName(preset.name);
    setLatitude(preset.lat.toString());
    setLongitude(preset.lon.toString());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED_FOR_ASSESSMENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-700/70 font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Accepted for Assessment
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/70 text-red-300 border border-red-700/70 font-mono">
            <AlertTriangle className="w-3 h-3" />
            Rejected
          </span>
        );
      case "ADDITIONAL_INFO_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/70 text-sky-300 border border-sky-700/70 font-mono">
            <Info className="w-3 h-3" />
            Additional Info Requested
          </span>
        );
      case "PENDING_REVIEW":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-700/70 font-mono">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-qc-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2 text-qc-accent text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4 text-qc-accent" />
            Role A: Citizen & Field Incident Intake
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-qc-text-primary">
            Incident Reporting Center
          </h1>
          <p className="text-qc-text-secondary text-xs mt-1 max-w-2xl leading-relaxed">
            Submit field incident observations with verified coordinates and impact parameters. All submissions are held in queue for relief coordinator review.
          </p>
        </div>

        {/* User Account / Demo Switcher */}
        <div className="flex items-center gap-3 bg-qc-surface-1 border border-qc-border-subtle p-3 rounded-xl shrink-0">
          {user ? (
            <div className="text-right">
              <div className="text-[11px] text-qc-text-tertiary">Authenticated Reporter</div>
              <div className="text-xs font-semibold text-qc-text-primary">{user.full_name}</div>
              <div className="text-[10px] text-qc-text-tertiary font-mono">
                {user.email} ({user.role})
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] text-amber-300 mb-1.5 font-mono">Demo Sign-In:</div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={LogIn}
                  onClick={() => quickSwitchDemo("reporter")}
                >
                  Reporter Demo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => quickSwitchDemo("admin")}
                >
                  Admin Demo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Operational Protocol Notice */}
      <div className="bg-sky-950/30 border border-sky-800/60 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
        <div className="text-xs text-sky-200/90 leading-relaxed font-sans">
          <strong className="text-sky-300 font-medium">Operational Protocol Notice:</strong> Submitted reports are assigned a unique tracking identifier (<code className="font-mono text-sky-200">REP-YYYYMMDD-XXXX</code>) and held in <code className="font-mono text-amber-300">PENDING_REVIEW</code> status. A submitted report is <span className="underline decoration-sky-500/50">not an independently verified disaster</span> and does not mobilize resources until formally accepted by an authorized Relief Coordinator.
        </div>
      </div>

      {/* Success Confirmation Banner */}
      {submittedReport && (
        <div className="bg-qc-surface-1 border border-emerald-600/70 rounded-xl p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-300 tracking-tight">
                  Disaster Report Successfully Logged
                </h3>
                <p className="text-xs text-qc-text-secondary mt-1">
                  Your incident has been recorded and placed into the relief coordinator's triage queue. It is awaiting review and is not yet a confirmed operational disaster.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-qc-text-tertiary">Report Code:</span>
                    <CopyableId id={submittedReport.report_code} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-qc-text-tertiary">Status:</span>
                    <span className="font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                      {submittedReport.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-qc-text-tertiary">
                    <span>Logged:</span>
                    <span>{new Date(submittedReport.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSubmittedReport(null)}
              className="text-qc-text-tertiary hover:text-qc-text-primary p-1 rounded transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Form + My Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 bg-qc-surface-1 border border-qc-border-subtle rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6 text-qc-text-primary font-semibold text-base border-b border-qc-border-subtle pb-3">
            <Layers className="w-4 h-4 text-qc-accent" />
            <span>Field Incident Intake Form</span>
          </div>

          {formError && (
            <div className="mb-6">
              <ErrorState title="Validation Error" message={formError} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Disaster Type & Event Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1.5">
                  Disaster Type *
                </label>
                <select
                  value={disasterType}
                  onChange={(e) => setDisasterType(e.target.value)}
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                >
                  <option value="flood">Flood (Inundation / Overflow)</option>
                  <option value="earthquake">Earthquake (Tectonic / Tremor)</option>
                  <option value="cyclone">Cyclone / Severe Gale</option>
                  <option value="landslide">Landslide / Mudflow</option>
                  <option value="wildfire">Wildfire / Forest Thermal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1.5">
                  Occurrence Timestamp *
                </label>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  required
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent font-mono"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-qc-text-secondary mb-1.5">
                Incident Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Flash flood submerging residential colonies in Barpeta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary placeholder:text-qc-text-disabled focus:outline-none focus:border-qc-accent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-qc-text-secondary mb-1.5">
                Field Situation & On-Ground Impact *
              </label>
              <textarea
                rows={3}
                placeholder="Describe current situation: water height, housing damage, bridge washouts, medical urgencies..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary placeholder:text-qc-text-disabled focus:outline-none focus:border-qc-accent leading-relaxed"
              />
            </div>

            {/* Location & Coordinates */}
            <div className="bg-qc-surface-2/70 border border-qc-border-subtle rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-qc-text-primary flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-qc-accent" />
                  Geospatial Coordinates
                </span>
                <span className="text-[10px] text-qc-text-tertiary font-mono">WGS84 EPSG:4326</span>
              </div>

              <div>
                <label className="block text-[11px] text-qc-text-secondary mb-1">
                  Location Name / Physical Address *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Subansiri Embankment, North Lakhimpur, Assam"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  required
                  className="w-full bg-qc-surface-1 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-qc-text-secondary mb-1">
                    Latitude (-90 to 90) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    required
                    className="w-full bg-qc-surface-1 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-qc-text-secondary mb-1">
                    Longitude (-180 to 180) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    required
                    className="w-full bg-qc-surface-1 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent font-mono"
                  />
                </div>
              </div>

              {/* Presets */}
              <div className="pt-1">
                <div className="text-[10px] text-qc-text-tertiary mb-1 font-mono uppercase">
                  Quick Location Presets:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LOCATION_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectPreset(p)}
                      className="px-2 py-0.5 text-[11px] bg-qc-surface-1 hover:bg-qc-surface-3 text-qc-text-secondary hover:text-qc-text-primary rounded border border-qc-border-subtle transition font-mono"
                    >
                      {p.name.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Assessment Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1">
                  Est. Affected Population
                </label>
                <input
                  type="number"
                  min="0"
                  max="5000000"
                  value={affectedPop}
                  onChange={(e) => setAffectedPop(e.target.value)}
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent font-mono"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1">
                  Damage Severity (0.0 to 1.0)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={damageSeverity}
                    onChange={(e) => setDamageSeverity(parseFloat(e.target.value))}
                    className="w-full accent-qc-accent cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-qc-accent w-10 text-right tabular-nums">
                    {damageSeverity.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1">
                  Road Access Available?
                </label>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <label className="flex items-center gap-1.5 text-qc-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="road_access"
                      checked={roadAccessible}
                      onChange={() => setRoadAccessible(true)}
                      className="accent-emerald-500"
                    />
                    <span>Yes (Passable)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-qc-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="road_access"
                      checked={!roadAccessible}
                      onChange={() => setRoadAccessible(false)}
                      className="accent-red-500"
                    />
                    <span>No (Cut Off)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Evidence URL */}
            <div>
              <label className="block text-xs font-medium text-qc-text-secondary mb-1">
                Supporting Evidence / Media Link (Optional)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... or https://sitrep-agency.org/..."
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary placeholder:text-qc-text-disabled focus:outline-none focus:border-qc-accent"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Send}
                loading={submitMutation.isPending}
                className="w-full font-semibold"
              >
                Submit Incident Report for Coordinator Review
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: User's Reports Status Dashboard (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-qc-border-subtle pb-3 mb-4">
              <div className="flex items-center gap-2 font-semibold text-qc-text-primary text-sm">
                <Clock className="w-4 h-4 text-qc-accent" />
                <span>My Submitted Reports</span>
              </div>
              <span className="text-[11px] bg-qc-surface-2 text-qc-text-secondary px-2 py-0.5 rounded font-mono tabular-nums">
                {myReports.length} reports
              </span>
            </div>

            {reportsLoading ? (
              <div className="py-8 text-center text-xs text-qc-text-tertiary">
                Loading your filed reports...
              </div>
            ) : myReports.length === 0 ? (
              <EmptyState
                title="No Reports Filed Yet"
                description="Use the intake form to file an on-ground incident observation."
                illustration="reports"
              />
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {myReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3.5 rounded-xl bg-qc-surface-2/60 border border-qc-border-subtle hover:border-qc-border-strong transition space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-bold text-qc-accent">
                          {report.report_code}
                        </div>
                        <h4 className="text-xs font-semibold text-qc-text-primary mt-0.5">
                          {report.title}
                        </h4>
                      </div>
                      <div className="shrink-0">{getStatusBadge(report.status)}</div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-qc-text-tertiary">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-qc-accent" />
                        {report.location_name}
                      </span>
                      <span>•</span>
                      <span className="capitalize text-qc-text-secondary">{report.disaster_type}</span>
                    </div>

                    <p className="text-[11px] text-qc-text-secondary line-clamp-2 leading-relaxed">
                      {report.description}
                    </p>

                    {/* Admin feedback if present */}
                    {report.admin_notes && (
                      <div className="p-2 rounded bg-qc-surface-1 border border-qc-border-subtle text-[11px]">
                        <div className="font-semibold text-qc-text-primary flex items-center gap-1 mb-0.5">
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          <span>Review Feedback ({report.reviewed_by_name || "Coordinator"}):</span>
                        </div>
                        <div className="text-qc-text-secondary italic">{report.admin_notes}</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-qc-border-subtle text-[10px] text-qc-text-tertiary font-mono">
                      <span>Submitted: {new Date(report.created_at).toLocaleDateString()}</span>
                      {report.associated_event_id && (
                        <span className="text-emerald-400 font-bold">
                          Assessed Event Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
