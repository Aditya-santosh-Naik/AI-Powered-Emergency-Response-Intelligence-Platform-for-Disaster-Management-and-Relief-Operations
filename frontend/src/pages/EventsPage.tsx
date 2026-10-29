import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Search,
  Filter,
  Maximize2,
  Users,
  Building,
  Globe,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "../api/client";
import { SeverityBadge } from "../components/SeverityBadge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ProvenanceLabel } from "../components/ui/ProvenanceLabel";

export const EventsPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [indiaOnly, setIndiaOnly] = useState<boolean>(true);

  const { data: events = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["events", selectedType, selectedSource],
    queryFn: () =>
      api.getEvents({
        event_type: selectedType || undefined,
        source: selectedSource || undefined,
        limit: 200,
      }),
  });

  const { data: eventDetail } = useQuery({
    queryKey: ["event-detail", detailEventId],
    queryFn: () => (detailEventId ? api.getEventDetail(detailEventId) : null),
    enabled: !!detailEventId,
  });

  const isIndiaCoords = (geom: any, country?: string | null) => {
    if (country && country.toLowerCase().includes("india")) return true;
    if (!geom || !geom.coordinates || geom.coordinates.length < 2) return false;
    const [lon, lat] = geom.coordinates;
    return lat >= 6.0 && lat <= 38.0 && lon >= 65.0 && lon <= 98.5;
  };

  const filteredEvents = events.filter((ev) => {
    if (indiaOnly && !isIndiaCoords(ev.geometry, ev.country)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.title.toLowerCase().includes(q) ||
      (ev.country && ev.country.toLowerCase().includes(q)) ||
      (ev.description && ev.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-qc-border-subtle">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/80 flex items-center justify-center text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold text-qc-text-primary tracking-tight">
              Disaster Events Intelligence Feed
            </h1>
          </div>
          <p className="text-xs text-qc-text-secondary mt-1">
            Continuous ingestion from GDACS, USGS, NDMA, and satellite sensors (Requirement R1).
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          loading={isFetching}
          onClick={() => refetch()}
        >
          Refresh Feed
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-3.5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-qc-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident title, country, or location..."
            className="w-full pl-9 pr-4 py-1.5 bg-qc-surface-2 border border-qc-border-subtle rounded-md text-xs text-qc-text-primary placeholder:text-qc-text-disabled focus:outline-none focus:border-qc-accent"
          />
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 bg-qc-surface-2 border border-qc-border-subtle rounded-md px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-qc-text-tertiary" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-xs text-qc-text-primary focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-qc-surface-2">All Event Types</option>
              <option value="earthquake" className="bg-qc-surface-2">Earthquakes</option>
              <option value="flood" className="bg-qc-surface-2">Floods</option>
              <option value="cyclone" className="bg-qc-surface-2">Cyclones</option>
              <option value="wildfire" className="bg-qc-surface-2">Wildfires</option>
              <option value="drought" className="bg-qc-surface-2">Droughts</option>
            </select>
          </div>

          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-qc-surface-2 border border-qc-border-subtle rounded-md px-2.5 py-1 text-xs text-qc-text-primary focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-qc-surface-2">All Feed Sources</option>
            <option value="GDACS" className="bg-qc-surface-2">GDACS</option>
            <option value="USGS" className="bg-qc-surface-2">USGS</option>
            <option value="NDMA" className="bg-qc-surface-2">NDMA (India)</option>
            <option value="FIRMS" className="bg-qc-surface-2">NASA FIRMS</option>
            <option value="CITIZEN_REPORT_CONFIRMED" className="bg-qc-surface-2">Citizen Reports</option>
          </select>

          <label className="flex items-center space-x-2 bg-qc-surface-2 border border-qc-border-subtle rounded-md px-2.5 py-1 text-xs text-qc-text-primary cursor-pointer hover:border-qc-border-strong transition">
            <input
              type="checkbox"
              checked={indiaOnly}
              onChange={(e) => setIndiaOnly(e.target.checked)}
              className="rounded bg-qc-surface-1 border-qc-border-subtle text-qc-accent focus:ring-0"
            />
            <span className="text-xs font-medium">India Focus</span>
          </label>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-qc-text-tertiary">
            Loading incident intelligence...
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No Matching Disaster Events"
            description="No incidents match the active filters. Adjust your search criteria or sync feeds."
            illustration="map"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-qc-surface-2 text-qc-text-tertiary uppercase text-[10px] font-mono tracking-wider border-b border-qc-border-subtle">
                <tr>
                  <th className="py-3 px-4">Event & Location</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Severity / Intensity</th>
                  <th className="py-3 px-4">Feed Source</th>
                  <th className="py-3 px-4">Detected Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-qc-border-subtle/70 text-qc-text-secondary">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-qc-surface-2/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-qc-text-primary text-xs">{ev.title}</div>
                      {ev.country && (
                        <div className="text-[11px] text-qc-text-tertiary">{ev.country}</div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="capitalize text-[11px] font-mono px-2 py-0.5 rounded bg-qc-surface-2 text-qc-text-secondary border border-qc-border-subtle">
                        {ev.event_type}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <SeverityBadge
                        level={ev.alert_level || (ev.magnitude ? `M${ev.magnitude}` : "Active")}
                        score={ev.magnitude ?? undefined}
                      />
                    </td>

                    <td className="py-3 px-4">
                      <ProvenanceLabel
                        type={ev.is_sample ? "synthetic" : "external"}
                        sourceName={ev.source}
                      />
                    </td>

                    <td className="py-3 px-4 text-[11px] text-qc-text-tertiary font-mono">
                      {new Date(ev.started_at).toLocaleDateString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDetailEventId(ev.id)}
                      >
                        Inspect Impact
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {detailEventId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-qc-surface-1 border border-qc-border-strong rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-qc-border-subtle pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-qc-surface-2 text-qc-text-secondary border border-qc-border-subtle">
                  {eventDetail?.event_type}
                </span>
                <h3 className="text-base font-bold text-qc-text-primary mt-1.5">
                  {eventDetail?.title}
                </h3>
              </div>
              <button
                onClick={() => setDetailEventId(null)}
                className="text-qc-text-tertiary hover:text-qc-text-primary p-1 rounded-md hover:bg-qc-surface-2 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {eventDetail?.description && (
              <p className="text-xs text-qc-text-secondary leading-relaxed bg-qc-surface-2 p-3 rounded-lg border border-qc-border-subtle">
                {eventDetail.description}
              </p>
            )}

            {/* Impact Assessment Cards */}
            <div>
              <h4 className="text-xs font-semibold text-qc-text-tertiary uppercase tracking-wider mb-2 font-mono">
                Geospatial Impact Assessment (Requirement R2)
              </h4>

              {eventDetail?.impact_zones && eventDetail.impact_zones.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-qc-surface-2 p-3 rounded-lg border border-qc-border-subtle">
                    <div className="flex items-center space-x-1.5 text-qc-text-tertiary text-[11px]">
                      <Maximize2 className="h-3.5 w-3.5 text-amber-400" />
                      <span>Impact Radius</span>
                    </div>
                    <div className="text-base font-bold font-mono text-qc-text-primary mt-1 tabular-nums">
                      {eventDetail.impact_zones[0].radius_km} km
                    </div>
                  </div>

                  <div className="bg-qc-surface-2 p-3 rounded-lg border border-qc-border-subtle">
                    <div className="flex items-center space-x-1.5 text-qc-text-tertiary text-[11px]">
                      <Users className="h-3.5 w-3.5 text-sky-400" />
                      <span>Exposed Pop</span>
                    </div>
                    <div className="text-base font-bold font-mono text-qc-text-primary mt-1 tabular-nums">
                      {eventDetail.impact_zones[0].population_exposed?.toLocaleString() || "N/A"}
                    </div>
                  </div>

                  <div className="bg-qc-surface-2 p-3 rounded-lg border border-qc-border-subtle">
                    <div className="flex items-center space-x-1.5 text-qc-text-tertiary text-[11px]">
                      <Building className="h-3.5 w-3.5 text-emerald-400" />
                      <span>OSM Buildings</span>
                    </div>
                    <div className="text-base font-bold font-mono text-qc-text-primary mt-1 tabular-nums">
                      {eventDetail.impact_zones[0].building_count?.toLocaleString() || "N/A"}
                    </div>
                  </div>

                  <div className="bg-qc-surface-2 p-3 rounded-lg border border-qc-border-subtle">
                    <div className="flex items-center space-x-1.5 text-qc-text-tertiary text-[11px]">
                      <Globe className="h-3.5 w-3.5 text-purple-400" />
                      <span>Total Area</span>
                    </div>
                    <div className="text-base font-bold font-mono text-qc-text-primary mt-1 tabular-nums">
                      {eventDetail.impact_zones[0].area_sq_km} km²
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-qc-surface-2 rounded-lg text-center text-xs text-qc-text-tertiary border border-qc-border-subtle">
                  Impact assessment in progress...
                </div>
              )}
            </div>

            {/* Grid Classification Breakdown (R4) */}
            {eventDetail?.grid_cells && eventDetail.grid_cells.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-qc-text-tertiary uppercase tracking-wider mb-2 font-mono">
                  Severity Grid Cells (Requirement R4)
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-qc-border-subtle rounded-lg p-2.5 bg-qc-surface-2">
                  {eventDetail.grid_cells.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-xs p-2 bg-qc-surface-1 rounded border border-qc-border-subtle"
                    >
                      <span className="font-mono text-qc-text-secondary text-[11px]">
                        Cell #{i + 1}
                      </span>
                      <div className="flex items-center space-x-3 text-[11px]">
                        <span className="text-qc-text-tertiary font-mono tabular-nums">
                          Hazard: {(c.hazard_intensity * 100).toFixed(0)}%
                        </span>
                        <span className="text-qc-text-tertiary font-mono tabular-nums">
                          Pop: {c.population_density}/km²
                        </span>
                        <SeverityBadge level={c.severity_class} score={c.severity_score} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Bulletin Link */}
            {eventDetail?.source_url && (
              <div className="pt-2 border-t border-qc-border-subtle flex justify-end">
                <a
                  href={eventDetail.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 text-xs text-qc-accent hover:underline"
                >
                  <span>Official Alert Bulletin</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
