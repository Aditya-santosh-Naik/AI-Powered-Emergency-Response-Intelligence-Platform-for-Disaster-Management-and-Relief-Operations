import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Truck,
  Users,
  Building,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client";
import type { DisasterEvent, SituationReportData } from "../types";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonCard } from "../components/ui/SkeletonLoader";

export const SitRepPage: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Queries
  const { data: events = [] } = useQuery<DisasterEvent[]>({
    queryKey: ["events"],
    queryFn: () => api.getEvents({ limit: 50 }),
  });

  const {
    data: sitrep,
    isLoading: sitrepLoading,
    refetch: refetchSitRep,
  } = useQuery<SituationReportData>({
    queryKey: ["sitrep", selectedEventId],
    queryFn: () => api.getSitRep(selectedEventId),
    enabled: !!selectedEventId,
  });

  // Default to first event when loaded
  React.useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const reportText = sitrep?.markdown_report || sitrep?.summary || sitrep?.markdown || "";
  const metrics = sitrep?.metrics || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in-up">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6" data-print-hide>
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-sky-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            Official Relief Directive & Post-Event Analytics
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Situation Reports (SitRep)
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Consolidated operational post-event synthesis for NDMA/SDRF directors.
            Evaluates demand fulfillment ratios, logistics throughput, and disaster footprints.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print SitRep
          </Button>

          {selectedEventId && (
            <a
              href={api.getSitRepMarkdownUrl(selectedEventId)}
              target="_blank"
              rel="noopener noreferrer"
              download={`sitrep-${selectedEventId}.md`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Markdown</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Event Selection Control ────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-4 shadow-sm border border-border-subtle flex flex-col sm:flex-row gap-3 items-center justify-between" data-print-hide>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-text-secondary whitespace-nowrap">
            Target Disaster:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full sm:w-96 bg-slate-50 dark:bg-slate-800/60 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-medium focus:outline-none"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.country || "India"}) - {ev.event_type}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={() => refetchSitRep()}
          loading={sitrepLoading}
        >
          Regenerate Report
        </Button>
      </div>

      {/* ── Analytics KPI Cards ────────────────────────────────── */}
      {sitrep && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-panel rounded-2xl p-4 border border-border-subtle shadow-sm">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-[11px] font-semibold">Exposed Population</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary mt-1">
              {(metrics.total_pop_exposed || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">Assessed In Footprint</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-border-subtle shadow-sm">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-[11px] font-semibold">Exposed Buildings</span>
              <Building className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary mt-1">
              {(metrics.total_bld_exposed || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">OpenStreetMap Count</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-border-subtle shadow-sm">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-[11px] font-semibold">Haul Distance</span>
              <Truck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.avg_distance_km ? `${metrics.avg_distance_km} km` : "N/A"}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">Average Relay Length</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-border-subtle shadow-sm">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-[11px] font-semibold">Relief Convoys</span>
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
              {metrics.missions ? metrics.missions.total_missions : 0}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">
              Delivered: {metrics.missions ? metrics.missions.delivered : 0}
            </div>
          </div>
        </div>
      )}

      {/* ── Markdown Document Card ─────────────────────────────── */}
      {sitrepLoading ? (
        <SkeletonCard lines={8} />
      ) : sitrep ? (
        <div className="glass-panel rounded-2xl p-6 sm:p-10 shadow-2xl border border-border-subtle space-y-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary">
                Verified Incident SitRep • Protocol OP-2026
              </span>
            </div>
            <span className="text-[11px] font-mono text-text-tertiary">
              {sitrep.created_at ? new Date(sitrep.created_at).toUTCString() : "Live Snapshot"}
            </span>
          </div>

          {/* Render Markdown cleanly */}
          <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-4 font-sans text-text-primary">
            <pre className="whitespace-pre-wrap font-sans bg-transparent p-0 border-none text-text-primary text-xs sm:text-sm leading-relaxed">
              {reportText}
            </pre>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No Situation Report Available"
          description="Select a disaster event from the dropdown above to generate or review its situation report."
        />
      )}
    </div>
  );
};
