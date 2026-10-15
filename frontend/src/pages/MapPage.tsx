import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Popup,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import {
  Layers,
  Info,
  Globe,
  Users,
  Building,
  Maximize2,
  X,
  Warehouse,
} from "lucide-react";
import { api } from "../api/client";
import type { DisasterEvent } from "../types";
import { StatusStrip } from "../components/StatusStrip";
import { SeverityBadge } from "../components/SeverityBadge";

// Fix standard Leaflet default icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom depot icon
const depotIcon = new L.DivIcon({
  className: "custom-depot-marker",
  html: `<div style="background-color: #2563eb; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.4);"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/></svg></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export const MapPage: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showDepots, setShowDepots] = useState(true);

  // Queries
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents({ limit: 150 }),
  });

  const { data: depots = [] } = useQuery({
    queryKey: ["depots"],
    queryFn: api.getDepots,
  });

  const { data: gridCells = [] } = useQuery({
    queryKey: ["grid-cells"],
    queryFn: () => api.getGridCells({ limit: 400 }),
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ["event-detail", selectedEventId],
    queryFn: () => (selectedEventId ? api.getEventDetail(selectedEventId) : null),
    enabled: !!selectedEventId,
  });

  const getEventMarkerColor = (ev: DisasterEvent) => {
    const alert = (ev.alert_level || "").toLowerCase();
    if (alert === "red" || (ev.magnitude && ev.magnitude >= 6.0)) return "#ef4444";
    if (alert === "orange" || (ev.magnitude && ev.magnitude >= 4.5)) return "#f97316";
    if (alert === "yellow" || (ev.magnitude && ev.magnitude >= 3.0)) return "#f59e0b";
    return "#3b82f6";
  };

  const getGridCellColor = (severityClass: string) => {
    switch (severityClass) {
      case "Critical":
        return "#ef4444";
      case "High":
        return "#f97316";
      case "Moderate":
        return "#f59e0b";
      case "Low":
      default:
        return "#10b981";
    }
  };

  const extractEventCoords = (ev: DisasterEvent): [number, number] | null => {
    if (ev.geometry && ev.geometry.coordinates) {
      const coords = ev.geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        return [coords[1], coords[0]]; // [lat, lon]
      }
    }
    return null;
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-slate-950">
      {/* Top Status Strip */}
      <StatusStrip />

      {/* Main Map Viewport */}
      <div className="relative flex-1">
        <MapContainer
          center={[22.5937, 82.9629]} // Center over South Asia / India
          zoom={5}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          {/* High-contrast dark tile layer */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Grid Cells Overlay */}
          {showGrid &&
            gridCells.map((cell) => {
              if (!cell.geometry || !cell.geometry.coordinates) return null;
              // GeoJSON polygon coordinates are [[[lon, lat], ...]]
              const ring = cell.geometry.coordinates[0];
              if (!ring) return null;
              const positions: [number, number][] = ring.map((c: any) => [c[1], c[0]]);

              const color = getGridCellColor(cell.severity_class);

              return (
                <Polygon
                  key={cell.id}
                  positions={positions}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.35,
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1 text-xs">
                      <div className="font-bold flex items-center justify-between border-b border-slate-700 pb-1">
                        <span>Grid Cell Severity</span>
                        <SeverityBadge level={cell.severity_class} score={cell.severity_score} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                        <span className="text-slate-400">Hazard Intensity:</span>
                        <span className="font-mono text-slate-200">{(cell.hazard_intensity * 100).toFixed(0)}%</span>
                        <span className="text-slate-400">Population Density:</span>
                        <span className="font-mono text-slate-200">{cell.population_density} /km²</span>
                        <span className="text-slate-400">Building Density:</span>
                        <span className="font-mono text-slate-200">{cell.building_density} /km²</span>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}

          {/* Impact Zones (Footprints) for selected event or all events */}
          {showFootprints &&
            selectedEvent?.impact_zones.map((zone) => {
              if (!zone.geometry || !zone.geometry.coordinates) return null;
              const ring = zone.geometry.coordinates[0];
              if (!ring) return null;
              const positions: [number, number][] = ring.map((c: any) => [c[1], c[0]]);

              return (
                <Polygon
                  key={zone.id}
                  positions={positions}
                  pathOptions={{
                    color: "#f59e0b",
                    fillColor: "#f59e0b",
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: "4, 6",
                  }}
                >
                  <Popup>
                    <div className="p-1 text-xs space-y-1">
                      <div className="font-bold text-amber-400">Assessed Impact Footprint</div>
                      <div>Radius: {zone.radius_km} km</div>
                      <div>Exposed Population: {zone.population_exposed?.toLocaleString()}</div>
                      <div>OSM Buildings: {zone.building_count?.toLocaleString()}</div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}

          {/* Depots Markers */}
          {showDepots &&
            depots.map((d) => (
              <Marker key={d.id} position={[d.latitude, d.longitude]} icon={depotIcon}>
                <Popup>
                  <div className="p-1 text-xs space-y-1 max-w-xs">
                    <div className="font-bold flex items-center space-x-1.5 text-blue-400 border-b border-slate-700 pb-1">
                      <Warehouse className="h-4 w-4" />
                      <span>{d.name}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{d.address || "Strategic Logistics Depot"}</p>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Location: {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Disaster Events Markers */}
          {showEvents &&
            events.map((ev) => {
              const coords = extractEventCoords(ev);
              if (!coords) return null;

              const isSelected = selectedEventId === ev.id;
              const color = getEventMarkerColor(ev);

              return (
                <CircleMarker
                  key={ev.id}
                  center={coords}
                  radius={isSelected ? 11 : 7}
                  pathOptions={{
                    color: isSelected ? "#ffffff" : color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: isSelected ? 3 : 1.5,
                  }}
                  eventHandlers={{
                    click: () => setSelectedEventId(ev.id),
                  }}
                >
                  <Popup>
                    <div className="p-1 text-xs space-y-1.5 max-w-xs">
                      <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-slate-200">
                          {ev.event_type}
                        </span>
                        <SeverityBadge level={ev.alert_level || "Active"} score={ev.magnitude ?? undefined} />
                      </div>
                      <p className="font-semibold text-slate-100">{ev.title}</p>
                      {ev.description && <p className="text-slate-400 text-[11px] line-clamp-2">{ev.description}</p>}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Source: {ev.source}</span>
                        {ev.is_sample && (
                          <span className="text-amber-400 font-mono">Sample</span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedEventId(ev.id)}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white py-1 px-2 rounded text-center text-[11px] font-medium transition"
                      >
                        Inspect Impact Assessment
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
        </MapContainer>

        {/* Floating Layer Controls (Top Left) */}
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-2.5">
          <div className="flex items-center space-x-1.5 font-bold text-slate-200 border-b border-slate-800 pb-1.5">
            <Layers className="h-4 w-4 text-blue-400" />
            <span>Map Layers</span>
          </div>

          <div className="space-y-1.5 text-slate-300">
            <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>Disaster Events ({events.length})</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showFootprints}
                onChange={(e) => setShowFootprints(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Impact Footprints</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span>Grid Severity Cells ({gridCells.length})</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showDepots}
                onChange={(e) => setShowDepots(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
              />
              <span>Resource Depots ({depots.length})</span>
            </label>
          </div>
        </div>

        {/* Floating Legend (Bottom Left) */}
        <div className="absolute bottom-6 left-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-2">
          <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
            Severity Classification
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-sm bg-red-500 border border-red-400" />
              <span>Critical (≥75)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-sm bg-orange-500 border border-orange-400" />
              <span>High (50–74)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-sm bg-amber-500 border border-amber-400" />
              <span>Moderate (25–49)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-sm bg-emerald-500 border border-emerald-400" />
              <span>Low (&lt;25)</span>
            </div>
          </div>
        </div>

        {/* Floating Event Detail Drawer (Right Side) */}
        {selectedEvent && (
          <div className="absolute top-4 right-4 z-20 w-96 max-h-[calc(100%-2rem)] bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl shadow-2xl p-5 overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedEvent.event_type}
                </span>
                <h3 className="font-bold text-white text-base mt-1.5">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEventId(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedEvent.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{selectedEvent.description}</p>
            )}

            {/* Impact Assessment Metrics */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Info className="h-3.5 w-3.5 text-blue-400" />
                <span>Geospatial Impact Assessment (R2)</span>
              </h4>

              {selectedEvent.impact_zones.length > 0 ? (
                selectedEvent.impact_zones.map((zone, idx) => (
                  <div key={zone.id} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 space-y-2">
                    <div className="text-xs font-medium text-amber-400">Impact Zone #{idx + 1}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                        <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
                          <Maximize2 className="h-3 w-3 text-amber-400" />
                          <span>Impact Radius</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">{zone.radius_km} km</div>
                      </div>

                      <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                        <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
                          <Users className="h-3 w-3 text-blue-400" />
                          <span>Exposed Pop.</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">
                          {zone.population_exposed ? zone.population_exposed.toLocaleString() : "N/A"}
                        </div>
                      </div>

                      <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                        <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
                          <Building className="h-3 w-3 text-emerald-400" />
                          <span>OSM Buildings</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">
                          {zone.building_count ? zone.building_count.toLocaleString() : "N/A"}
                        </div>
                      </div>

                      <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                        <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
                          <Globe className="h-3 w-3 text-purple-400" />
                          <span>Footprint Area</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">{zone.area_sq_km} km²</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-800/40 p-3 rounded text-xs text-slate-400 italic text-center">
                  Footprint being processed... Click "Sync Feeds" to re-evaluate.
                </div>
              )}
            </div>

            {/* Grid Classification Breakdown (R4) */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Grid Cells ({selectedEvent.grid_cells.length} cells)
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedEvent.grid_cells.slice(0, 15).map((cell, i) => (
                  <div
                    key={cell.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-800/60 border border-slate-800 text-xs"
                  >
                    <span className="text-slate-300 font-mono text-[11px]">Cell #{i + 1}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-400">Hazard: {(cell.hazard_intensity * 100).toFixed(0)}%</span>
                      <SeverityBadge level={cell.severity_class} score={cell.severity_score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Source & Metadata */}
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Feed Source:</span>
                <span className="font-mono text-slate-200">{selectedEvent.source}</span>
              </div>
              <div className="flex justify-between">
                <span>Started:</span>
                <span className="font-mono text-slate-200">
                  {new Date(selectedEvent.started_at).toLocaleString()}
                </span>
              </div>
              {selectedEvent.source_url && (
                <div className="pt-1">
                  <a
                    href={selectedEvent.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline text-xs flex items-center space-x-1"
                  >
                    <span>View Official Alert Bulletin</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
