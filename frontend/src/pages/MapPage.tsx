import React, { useState, useMemo } from "react";
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
import { Link } from "react-router-dom";
import {
  Layers,
  Info,
  Globe,
  Users,
  Building,
  Maximize2,
  X,
  Warehouse,
  Sparkles,
  Package,
  Droplets,
  BriefcaseMedical,
  Home,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { api } from "../api/client";
import type { DisasterEvent } from "../types";
import { StatusStrip } from "../components/StatusStrip";
import { SeverityBadge } from "../components/SeverityBadge";
import { ProvenanceLabel } from "../components/ui/ProvenanceLabel";

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
  html: `<div style="background-color: #17233A; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #38BDF8; border: 2px solid #38BDF8; box-shadow: 0 4px 12px rgba(0,0,0,0.6);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const MapPage: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [basemap, setBasemap] = useState<"osm" | "dark" | "satellite">("dark");

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

  const { data: eventPredictions = [] } = useQuery({
    queryKey: ["event-predictions-drawer", selectedEventId],
    queryFn: () => (selectedEventId ? api.getEventPredictions(selectedEventId) : []),
    enabled: !!selectedEventId,
  });

  const getEventMarkerColor = (ev: DisasterEvent) => {
    const alert = (ev.alert_level || "").toLowerCase();
    if (alert === "red" || (ev.magnitude && ev.magnitude >= 6.0)) return "#EF4444";
    if (alert === "orange" || (ev.magnitude && ev.magnitude >= 4.5)) return "#F97316";
    if (alert === "yellow" || (ev.magnitude && ev.magnitude >= 3.0)) return "#F5B83D";
    return "#38BDF8";
  };

  const getGridCellColor = (severityClass: string) => {
    switch (severityClass) {
      case "Critical":
        return "#EF4444";
      case "High":
        return "#F97316";
      case "Moderate":
        return "#F5B83D";
      case "Low":
      default:
        return "#34B27B";
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

  // Restrict disaster events strictly to India & immediate border/maritime zones (lat: 6 to 38, lon: 65 to 98.5)
  const indiaEvents = useMemo(() => {
    return events.filter((ev) => {
      const country = (ev.country || "").toLowerCase();
      if (country.includes("india")) return true;
      const coords = extractEventCoords(ev);
      if (!coords) return false;
      const [lat, lon] = coords;
      return lat >= 6.0 && lat <= 38.0 && lon >= 65.0 && lon <= 98.5;
    });
  }, [events]);

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-qc-bg overflow-hidden">
      {/* Top Status Strip */}
      <StatusStrip />

      {/* Main Map Viewport */}
      <div className="relative flex-1">
        <MapContainer
          center={[22.5937, 78.9629]}
          zoom={5}
          minZoom={4.5}
          maxZoom={14}
          maxBounds={[
            [6.0, 65.0],
            [38.0, 99.0],
          ]}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          {/* Dynamic Free Basemap Layers */}
          {basemap === "osm" && (
            <TileLayer
              key="osm"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}
          {basemap === "dark" && (
            <>
              <TileLayer
                key="esri-dark"
                attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
              />
              <TileLayer
                key="esri-dark-ref"
                attribution=""
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
              />
            </>
          )}
          {basemap === "satellite" && (
            <TileLayer
              key="esri-satellite"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {/* Grid Cells Overlay */}
          {showGrid &&
            gridCells.map((cell) => {
              if (!cell.geometry || !cell.geometry.coordinates) return null;
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
                    fillOpacity: 0.3,
                    weight: 1.25,
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1.5 text-xs font-sans">
                      <div className="font-semibold flex items-center justify-between border-b border-qc-border-strong pb-1">
                        <span className="text-qc-text-primary">Severity Grid Cell</span>
                        <SeverityBadge level={cell.severity_class} score={cell.severity_score} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                        <span className="text-qc-text-secondary">Hazard Intensity:</span>
                        <span className="font-mono text-qc-text-primary tabular-nums">
                          {(cell.hazard_intensity * 100).toFixed(0)}%
                        </span>
                        <span className="text-qc-text-secondary">Pop Density:</span>
                        <span className="font-mono text-qc-text-primary tabular-nums">
                          {cell.population_density} /km²
                        </span>
                        <span className="text-qc-text-secondary">Building Density:</span>
                        <span className="font-mono text-qc-text-primary tabular-nums">
                          {cell.building_density} /km²
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}

          {/* Impact Zones (Footprints) */}
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
                    color: "#F5B83D",
                    fillColor: "#F5B83D",
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: "4, 6",
                  }}
                >
                  <Popup>
                    <div className="p-1 text-xs space-y-1.5 font-sans">
                      <div className="font-semibold text-amber-300 border-b border-qc-border-strong pb-1">
                        Impact Footprint (R2)
                      </div>
                      <div className="text-[11px] space-y-1 text-qc-text-secondary">
                        <div className="flex justify-between">
                          <span>Radius:</span>
                          <span className="font-mono text-qc-text-primary font-bold">{zone.radius_km} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Exposed Pop:</span>
                          <span className="font-mono text-qc-text-primary font-bold">
                            {zone.population_exposed ? zone.population_exposed.toLocaleString() : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>OSM Buildings:</span>
                          <span className="font-mono text-qc-text-primary font-bold">
                            {zone.building_count ? zone.building_count.toLocaleString() : "N/A"}
                          </span>
                        </div>
                      </div>
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
                  <div className="p-1 text-xs space-y-1.5 max-w-xs font-sans">
                    <div className="font-semibold flex items-center space-x-1.5 text-qc-accent border-b border-qc-border-strong pb-1">
                      <Warehouse className="h-4 w-4 shrink-0" />
                      <span>{d.name}</span>
                    </div>
                    <p className="text-qc-text-secondary text-[11px]">{d.address || "Strategic Logistics Base"}</p>
                    <div className="text-[10px] text-qc-text-tertiary font-mono">
                      Coordinates: {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Disaster Events Markers (India) */}
          {showEvents &&
            indiaEvents.map((ev) => {
              const coords = extractEventCoords(ev);
              if (!coords) return null;

              const isSelected = selectedEventId === ev.id;
              const color = getEventMarkerColor(ev);

              return (
                <CircleMarker
                  key={ev.id}
                  center={coords}
                  radius={isSelected ? 10 : 6.5}
                  pathOptions={{
                    color: isSelected ? "#38BDF8" : color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: isSelected ? 3 : 1.5,
                  }}
                  eventHandlers={{
                    click: () => setSelectedEventId(ev.id),
                  }}
                >
                  <Popup>
                    <div className="p-1 text-xs space-y-2 max-w-xs font-sans">
                      <div className="flex items-center justify-between border-b border-qc-border-strong pb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-qc-text-primary font-mono">
                          {ev.event_type}
                        </span>
                        <SeverityBadge level={ev.alert_level || "Active"} score={ev.magnitude ?? undefined} />
                      </div>
                      <p className="font-semibold text-qc-text-primary text-xs">{ev.title}</p>
                      {ev.description && (
                        <p className="text-qc-text-secondary text-[11px] line-clamp-2 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-qc-text-tertiary pt-1 border-t border-qc-border-subtle">
                        <span>Source: {ev.source}</span>
                        {ev.is_sample && (
                          <span className="text-amber-400 font-mono">Sample</span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedEventId(ev.id)}
                        className="w-full mt-1 bg-qc-surface-2 hover:bg-qc-surface-3 text-qc-accent border border-qc-border-strong py-1 px-2 rounded text-center text-xs font-medium transition"
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
        <div className="absolute top-4 left-4 z-20 bg-qc-surface-1/95 backdrop-blur-md border border-qc-border-strong rounded-xl p-3.5 shadow-2xl text-xs space-y-3 w-56">
          <div className="flex items-center space-x-2 font-semibold text-qc-text-primary border-b border-qc-border-subtle pb-2">
            <Layers className="h-4 w-4 text-qc-accent" />
            <span className="tracking-tight">Map Layers (India)</span>
          </div>

          <div className="space-y-2 text-qc-text-secondary">
            <label className="flex items-center justify-between cursor-pointer hover:text-qc-text-primary">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showEvents}
                  onChange={(e) => setShowEvents(e.target.checked)}
                  className="rounded bg-qc-surface-2 border-qc-border-strong text-qc-accent focus:ring-0"
                />
                <span>Events</span>
              </span>
              <span className="font-mono text-[11px] text-qc-text-tertiary tabular-nums">
                {indiaEvents.length}
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-qc-text-primary">
              <input
                type="checkbox"
                checked={showFootprints}
                onChange={(e) => setShowFootprints(e.target.checked)}
                className="rounded bg-qc-surface-2 border-qc-border-strong text-amber-500 focus:ring-0"
              />
              <span>Impact Footprints</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-qc-text-primary">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded bg-qc-surface-2 border-qc-border-strong text-emerald-500 focus:ring-0"
                />
                <span>Severity Grid</span>
              </span>
              <span className="font-mono text-[11px] text-qc-text-tertiary tabular-nums">
                {gridCells.length}
              </span>
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-qc-text-primary">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showDepots}
                  onChange={(e) => setShowDepots(e.target.checked)}
                  className="rounded bg-qc-surface-2 border-qc-border-strong text-sky-400 focus:ring-0"
                />
                <span>Depots</span>
              </span>
              <span className="font-mono text-[11px] text-qc-text-tertiary tabular-nums">
                {depots.length}
              </span>
            </label>
          </div>

          {/* Basemap Style Switcher */}
          <div className="border-t border-qc-border-subtle pt-2.5 space-y-1.5">
            <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-qc-text-tertiary">
              Basemap
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["dark", "osm", "satellite"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBasemap(m)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition text-center capitalize ${
                    basemap === m
                      ? "bg-qc-accent text-qc-accent-contrast font-semibold shadow-sm"
                      : "bg-qc-surface-2 text-qc-text-secondary hover:text-qc-text-primary border border-qc-border-subtle"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Legend (Bottom Left) */}
        <div className="absolute bottom-6 left-4 z-20 bg-qc-surface-1/95 backdrop-blur-md border border-qc-border-strong rounded-xl p-3 shadow-2xl text-xs space-y-2">
          <div className="font-semibold text-qc-text-secondary text-[11px] uppercase tracking-wider font-mono">
            Severity Classification
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="flex items-center space-x-1.5 text-qc-text-primary">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              <span>▲ Critical (≥75)</span>
            </div>
            <div className="flex items-center space-x-1.5 text-qc-text-primary">
              <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
              <span>◆ High (50–74)</span>
            </div>
            <div className="flex items-center space-x-1.5 text-qc-text-primary">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              <span>■ Mod (25–49)</span>
            </div>
            <div className="flex items-center space-x-1.5 text-qc-text-primary">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span>● Low (&lt;25)</span>
            </div>
          </div>
        </div>

        {/* Floating Event Detail Drawer (Right Side) */}
        {selectedEvent && (
          <div className="absolute top-4 right-4 z-20 w-96 max-h-[calc(100%-2rem)] bg-qc-surface-1/95 backdrop-blur-md border border-qc-border-strong rounded-xl shadow-2xl p-5 overflow-y-auto space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-start justify-between border-b border-qc-border-subtle pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-qc-surface-2 text-qc-text-secondary border border-qc-border-subtle">
                  {selectedEvent.event_type}
                </span>
                <h3 className="font-semibold text-qc-text-primary text-sm mt-1.5 leading-snug">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventId(null)}
                className="text-qc-text-tertiary hover:text-qc-text-primary p-1 rounded-md hover:bg-qc-surface-2 transition"
                title="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedEvent.description && (
              <p className="text-xs text-qc-text-secondary leading-relaxed">
                {selectedEvent.description}
              </p>
            )}

            {/* Impact Assessment Metrics */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-qc-text-tertiary uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                <Info className="h-3.5 w-3.5 text-qc-accent" />
                <span>Geospatial Impact Assessment (R2)</span>
              </h4>

              {selectedEvent.impact_zones.length > 0 ? (
                selectedEvent.impact_zones.map((zone, idx) => (
                  <div
                    key={zone.id}
                    className="bg-qc-surface-2/70 rounded-lg p-3 border border-qc-border-subtle space-y-2"
                  >
                    <div className="text-xs font-semibold text-amber-300 font-mono">
                      Impact Zone #{idx + 1}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                        <div className="flex items-center space-x-1 text-qc-text-tertiary text-[10px]">
                          <Maximize2 className="h-3 w-3 text-amber-400" />
                          <span>Hazard Radius</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                          {zone.radius_km} km
                        </div>
                      </div>

                      <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                        <div className="flex items-center space-x-1 text-qc-text-tertiary text-[10px]">
                          <Users className="h-3 w-3 text-sky-400" />
                          <span>Exposed Pop</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                          {zone.population_exposed ? zone.population_exposed.toLocaleString() : "N/A"}
                        </div>
                      </div>

                      <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                        <div className="flex items-center space-x-1 text-qc-text-tertiary text-[10px]">
                          <Building className="h-3 w-3 text-emerald-400" />
                          <span>OSM Buildings</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                          {zone.building_count ? zone.building_count.toLocaleString() : "N/A"}
                        </div>
                      </div>

                      <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                        <div className="flex items-center space-x-1 text-qc-text-tertiary text-[10px]">
                          <Globe className="h-3 w-3 text-purple-400" />
                          <span>Footprint Area</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                          {zone.area_sq_km} km²
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-qc-surface-2/40 p-3 rounded text-xs text-qc-text-tertiary italic text-center">
                  Footprint being processed... Click "Sync Feeds" to poll.
                </div>
              )}
            </div>

            {/* Resource Demand Predictions */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-qc-text-tertiary uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                  <Sparkles className="h-3.5 w-3.5 text-qc-accent" />
                  <span>Demand Prediction (W3–4)</span>
                </h4>
                <Link
                  to="/predictions"
                  className="text-[11px] text-qc-accent hover:text-qc-accent-hover flex items-center space-x-1 font-medium"
                >
                  <span>Simulate</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {eventPredictions.length > 0 ? (
                eventPredictions.map((pred, i) => {
                  const d = pred.resource_demands;
                  return (
                    <div
                      key={pred.id || i}
                      className="bg-qc-surface-2/80 rounded-lg p-3 border border-qc-border-subtle space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-qc-text-primary font-bold">
                          {pred.zone_id}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-700 font-mono">
                          {pred.urgency_class}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                          <div className="text-[10px] text-amber-300 flex items-center space-x-1 font-semibold">
                            <Package className="h-3 w-3" />
                            <span>Food Packets</span>
                          </div>
                          <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                            {d.food_packets?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-red-400 font-medium font-mono tabular-nums">
                            +{d.food_packets?.additional_quantity_recommended?.toLocaleString()} needed
                          </div>
                        </div>

                        <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                          <div className="text-[10px] text-sky-300 flex items-center space-x-1 font-semibold">
                            <Droplets className="h-3 w-3" />
                            <span>Clean Water</span>
                          </div>
                          <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                            {d.water_liters?.predicted_demand?.toLocaleString()} L
                          </div>
                          <div className="text-[10px] text-red-400 font-medium font-mono tabular-nums">
                            +{d.water_liters?.additional_quantity_recommended?.toLocaleString()} needed
                          </div>
                        </div>

                        <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                          <div className="text-[10px] text-pink-300 flex items-center space-x-1 font-semibold">
                            <BriefcaseMedical className="h-3 w-3" />
                            <span>Medical Kits</span>
                          </div>
                          <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                            {d.medical_kits?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-red-400 font-medium font-mono tabular-nums">
                            +{d.medical_kits?.additional_quantity_recommended?.toLocaleString()} needed
                          </div>
                        </div>

                        <div className="bg-qc-surface-1 p-2 rounded border border-qc-border-subtle">
                          <div className="text-[10px] text-purple-300 flex items-center space-x-1 font-semibold">
                            <Home className="h-3 w-3" />
                            <span>Shelter Spaces</span>
                          </div>
                          <div className="text-sm font-bold font-mono text-qc-text-primary mt-0.5 tabular-nums">
                            {d.shelter_spaces?.predicted_demand?.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-red-400 font-medium font-mono tabular-nums">
                            +{d.shelter_spaces?.additional_quantity_recommended?.toLocaleString()} needed
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-qc-text-tertiary bg-qc-surface-1 p-1.5 rounded border border-qc-border-subtle flex items-center justify-between font-mono">
                        <span>v{pred.model_version}</span>
                        <span className="text-qc-accent font-medium">{pred.planning_horizon_days}d Horizon</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-qc-surface-2/40 p-2.5 rounded text-xs text-qc-text-tertiary italic text-center">
                  Predicting resource demands for zones...
                </div>
              )}
            </div>

            {/* Grid Classification Breakdown (R4) */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-qc-text-tertiary uppercase tracking-wider font-mono">
                Grid Cells ({selectedEvent.grid_cells.length})
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {selectedEvent.grid_cells.slice(0, 15).map((cell, i) => (
                  <div
                    key={cell.id}
                    className="flex items-center justify-between p-2 rounded bg-qc-surface-2 border border-qc-border-subtle text-xs"
                  >
                    <span className="text-qc-text-secondary font-mono text-[11px]">Cell #{i + 1}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-qc-text-tertiary font-mono tabular-nums">
                        {(cell.hazard_intensity * 100).toFixed(0)}%
                      </span>
                      <SeverityBadge level={cell.severity_class} score={cell.severity_score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Source & Metadata */}
            <div className="pt-2 border-t border-qc-border-subtle text-[11px] text-qc-text-tertiary space-y-1.5">
              <div className="flex justify-between items-center">
                <span>Feed Provenance:</span>
                <ProvenanceLabel
                  type={selectedEvent.is_sample ? "synthetic" : "external"}
                  sourceName={selectedEvent.source}
                />
              </div>
              <div className="flex justify-between font-mono text-[10px]">
                <span>Started:</span>
                <span className="text-qc-text-secondary">
                  {new Date(selectedEvent.started_at).toLocaleString()}
                </span>
              </div>
              {selectedEvent.source_url && (
                <div className="pt-1">
                  <a
                    href={selectedEvent.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-qc-accent hover:underline text-xs inline-flex items-center gap-1"
                  >
                    <span>Official Feed Bulletin</span>
                    <ExternalLink className="w-3 h-3" />
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
