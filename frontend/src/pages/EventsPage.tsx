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

export const EventsPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [detailEventId, setDetailEventId] = useState<string | null>(null);

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

  const filteredEvents = events.filter((ev) => {
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <span>Disaster Events Intelligence Feed</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time multi-source ingest from GDACS, USGS, NDMA, and NASA satellite observations (Requirement R1).
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition self-start"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by event title, country, or location..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Event Types</option>
              <option value="earthquake">Earthquakes</option>
              <option value="flood">Floods</option>
              <option value="cyclone">Cyclones</option>
              <option value="wildfire">Wildfires</option>
              <option value="drought">Droughts</option>
            </select>
          </div>

          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Feed Sources</option>
            <option value="GDACS">GDACS</option>
            <option value="USGS">USGS</option>
            <option value="NDMA">NDMA (India)</option>
            <option value="FIRMS">NASA FIRMS</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading disaster events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">No disaster events matching criteria.</p>
            <p className="text-xs">Try selecting a different filter or sync live data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Event & Location</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Severity / Intensity</th>
                  <th className="py-3.5 px-4">Feed Source</th>
                  <th className="py-3.5 px-4">Detected Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{ev.title}</div>
                      {ev.country && <div className="text-xs text-slate-400">{ev.country}</div>}
                    </td>

                    <td className="py-3 px-4">
                      <span className="capitalize text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
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
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-xs text-slate-300">{ev.source}</span>
                        {ev.is_sample && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono">
                            Sample
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                      {new Date(ev.started_at).toLocaleDateString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDetailEventId(ev.id)}
                        className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded transition font-medium"
                      >
                        Impact Assessment
                      </button>
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {eventDetail?.event_type}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{eventDetail?.title}</h3>
              </div>
              <button
                onClick={() => setDetailEventId(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {eventDetail?.description && (
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                {eventDetail.description}
              </p>
            )}

            {/* Impact Assessment Cards */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Geospatial Impact Assessment (Requirement R2)
              </h4>

              {eventDetail?.impact_zones && eventDetail.impact_zones.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                      <Maximize2 className="h-3.5 w-3.5 text-amber-400" />
                      <span>Impact Radius</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white mt-1">
                      {eventDetail.impact_zones[0].radius_km} km
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                      <span>Exposed Pop.</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white mt-1">
                      {eventDetail.impact_zones[0].population_exposed?.toLocaleString() || "N/A"}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                      <Building className="h-3.5 w-3.5 text-emerald-400" />
                      <span>OSM Buildings</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white mt-1">
                      {eventDetail.impact_zones[0].building_count?.toLocaleString() || "N/A"}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                      <Globe className="h-3.5 w-3.5 text-purple-400" />
                      <span>Total Area</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white mt-1">
                      {eventDetail.impact_zones[0].area_sq_km} km²
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl text-center text-xs text-slate-400 border border-slate-800">
                  Impact assessment in progress...
                </div>
              )}
            </div>

            {/* Grid Classification Breakdown (R4) */}
            {eventDetail?.grid_cells && eventDetail.grid_cells.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Grid Zone Severity Classification (Requirement R4)
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950">
                  {eventDetail.grid_cells.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-lg">
                      <span className="font-mono text-slate-300">Grid Cell #{i + 1}</span>
                      <div className="flex items-center space-x-3 text-[11px]">
                        <span className="text-slate-400">Hazard: {(c.hazard_intensity * 100).toFixed(0)}%</span>
                        <span className="text-slate-400">Pop: {c.population_density}/km²</span>
                        <SeverityBadge level={c.severity_class} score={c.severity_score} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Bulletin Link */}
            {eventDetail?.source_url && (
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <a
                  href={eventDetail.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  <span>Official Alert Report</span>
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
