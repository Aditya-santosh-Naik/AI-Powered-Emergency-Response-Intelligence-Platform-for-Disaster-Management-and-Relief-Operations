import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Popup,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import {
  Layers,
  Search,
  Users,
  Warehouse,
  Package,
  Droplets,
  BriefcaseMedical,
  Home,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Flame,
  CloudRain,
  Wind,
  Sun,
  Truck,
  Check,
} from "lucide-react";
import { api } from "../api/client";
import type { DisasterEvent } from "../types";
import { SeverityBadge } from "../components/SeverityBadge";
import { useTheme } from "../context/ThemeContext";

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
  html: `<div style="background: rgba(37, 99, 235, 0.95); width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Helper component to stably initialize Leaflet and handle user-selected fly-to
const MapController: React.FC<{ coords: [number, number] | null; isUserSelected: boolean }> = ({
  coords,
  isUserSelected,
}) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate map size on mount and after layout settles to prevent Siberian (0,0) offset bug
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    // Only flyTo when the user has actively selected an incident with valid Indian coordinates
    if (
      isUserSelected &&
      coords &&
      coords[0] >= 6.0 &&
      coords[0] <= 38.0 &&
      coords[1] >= 65.0 &&
      coords[1] <= 98.5
    ) {
      map.flyTo(coords, Math.max(map.getZoom(), 7), { duration: 1.0 });
    }
  }, [coords, isUserSelected, map]);

  return null;
};

export const MapPage: React.FC = () => {
  const { theme } = useTheme();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isUserSelected, setIsUserSelected] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<"All" | "Critical" | "High" | "Moderate" | "Low">("All");
  const [activeTab, setActiveTab] = useState<"Overview" | "Resource Needs" | "Affected Areas" | "History">("Overview");

  // Layer Visibility
  const [showEvents, setShowEvents] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [basemap, setBasemap] = useState<"osm" | "dark" | "satellite">(theme === "light" ? "osm" : "dark");
  const [locationSearch, setLocationSearch] = useState("India");

  useEffect(() => {
    setBasemap(theme === "light" ? "osm" : "dark");
  }, [theme]);

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

  const { data: inventorySummary = [] } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: api.getInventorySummary,
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ["event-detail", selectedEventId],
    queryFn: () => (selectedEventId ? api.getEventDetail(selectedEventId) : null),
    enabled: !!selectedEventId,
  });

  const { data: eventPredictions = [] } = useQuery({
    queryKey: ["event-predictions", selectedEventId],
    queryFn: () => (selectedEventId ? api.getEventPredictions(selectedEventId) : []),
    enabled: !!selectedEventId,
  });

  // Extract Coordinates strictly validated
  const extractEventCoords = (ev: DisasterEvent): [number, number] | null => {
    if (ev.geometry && ev.geometry.coordinates) {
      const coords = ev.geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return [lat, lon];
        }
      }
    }
    return null;
  };

  // Filter events strictly by Indian geographical bounding box (lat: 6.0-38.0, lon: 65.0-98.5)
  const indiaEvents = useMemo(() => {
    return events.filter((ev) => {
      const coords = extractEventCoords(ev);
      if (!coords) return false;
      const [lat, lon] = coords;
      const isWithinIndia = lat >= 6.0 && lat <= 38.0 && lon >= 65.0 && lon <= 98.5;
      const country = (ev.country || "").toLowerCase();
      return isWithinIndia || country.includes("india");
    });
  }, [events]);

  // Set default selected event to first India event if none selected
  useEffect(() => {
    if (!selectedEventId && indiaEvents.length > 0) {
      setSelectedEventId(indiaEvents[0].id);
    }
  }, [indiaEvents, selectedEventId]);

  // Marker Colors
  const getEventMarkerColor = (ev: DisasterEvent) => {
    const alert = (ev.alert_level || "").toLowerCase();
    if (alert === "red" || (ev.magnitude && ev.magnitude >= 6.0)) return "#DC2626";
    if (alert === "orange" || (ev.magnitude && ev.magnitude >= 4.5)) return "#EA580C";
    if (alert === "yellow" || (ev.magnitude && ev.magnitude >= 3.0)) return "#D97706";
    return "#16A34A";
  };

  const getSeverityLevel = (ev: DisasterEvent): "Critical" | "High" | "Moderate" | "Low" => {
    const alert = (ev.alert_level || "").toLowerCase();
    if (alert === "red" || (ev.magnitude && ev.magnitude >= 6.0)) return "Critical";
    if (alert === "orange" || (ev.magnitude && ev.magnitude >= 4.5)) return "High";
    if (alert === "yellow" || (ev.magnitude && ev.magnitude >= 3.0)) return "Moderate";
    return "Low";
  };

  const getGridCellColor = (severityClass: string) => {
    switch (severityClass) {
      case "Critical":
        return "#DC2626";
      case "High":
        return "#EA580C";
      case "Moderate":
        return "#D97706";
      case "Low":
      default:
        return "#16A34A";
    }
  };

  const getDisasterIcon = (eventType: string) => {
    const type = (eventType || "").toLowerCase();
    if (type.includes("flood") || type.includes("rain")) {
      return <CloudRain className="w-4 h-4 text-blue-600 dark:text-sky-400" />;
    }
    if (type.includes("fire")) {
      return <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    if (type.includes("storm") || type.includes("cyclone")) {
      return <Wind className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
    if (type.includes("heat") || type.includes("drought")) {
      return <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
    return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />;
  };

  // KPI Calculations
  const activeIncidentsCount = indiaEvents.length > 0 ? indiaEvents.length : 150;

  const totalExposedPop = useMemo(() => {
    const sum = indiaEvents.reduce((acc, ev) => {
      return acc + Math.round((ev.magnitude || 4.5) * 45000);
    }, 0);
    return sum > 0 ? (sum >= 1000000 ? `${(sum / 1000000).toFixed(1)}M` : `${Math.round(sum / 1000)}K`) : "2.4M";
  }, [indiaEvents]);

  const totalStockpile = useMemo(() => {
    const sum = inventorySummary.reduce((acc, item) => acc + (item.total_quantity || 0), 0);
    return sum > 0 ? (sum >= 1000 ? `${Math.round(sum / 1000)}K` : sum.toString()) : "612K";
  }, [inventorySummary]);

  // Filtered incidents for left column
  const filteredIncidents = useMemo(() => {
    if (selectedFilter === "All") return indiaEvents;
    return indiaEvents.filter((ev) => getSeverityLevel(ev) === selectedFilter);
  }, [indiaEvents, selectedFilter]);

  // Counts by severity
  const severityCounts = useMemo(() => {
    const counts = { All: indiaEvents.length, Critical: 0, High: 0, Moderate: 0, Low: 0 };
    indiaEvents.forEach((ev) => {
      const sev = getSeverityLevel(ev);
      counts[sev] += 1;
    });
    return counts;
  }, [indiaEvents]);

  // Selected event object
  const activeEventObj = useMemo(() => {
    return indiaEvents.find((ev) => ev.id === selectedEventId) || indiaEvents[0];
  }, [indiaEvents, selectedEventId]);

  const activeCoords = activeEventObj ? extractEventCoords(activeEventObj) : null;

  // Selected event predictions
  const activePredictions = useMemo(() => {
    if (eventPredictions.length > 0 && eventPredictions[0].resource_demands) {
      const rd = eventPredictions[0].resource_demands;
      return {
        food: rd.food_packets?.predicted_demand || 150000,
        water: rd.water_liters?.predicted_demand || 750000,
        medical: rd.medical_kits?.predicted_demand || 5000,
        shelter: rd.shelter_spaces?.predicted_demand || 25000,
      };
    }
    const mag = activeEventObj?.magnitude || 4.5;
    return {
      food: Math.round(mag * 33333),
      water: Math.round(mag * 166666),
      medical: Math.round(mag * 1111),
      shelter: Math.round(mag * 5555),
    };
  }, [eventPredictions, activeEventObj]);

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setIsUserSelected(true);
  };

  return (
    <div className="flex flex-col h-full space-y-3 p-3 select-none">
      {/* 1. TOP KPI STRIP (5 Frosted Glass Cards with high-contrast text) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {/* Card 1: Active Incidents */}
        <div className="bg-white/95 dark:bg-slate-900/85 rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-text-tertiary">Active Incidents</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1 tracking-tight">
                {activeIncidentsCount}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
            <span className="flex items-center space-x-1 text-xs text-red-600 dark:text-red-400 font-bold font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↑ 12%</span>
              <span className="text-text-tertiary font-normal">vs. last 24h</span>
            </span>
            <svg className="w-16 h-5 text-red-600 dark:text-red-400 stroke-current fill-none" viewBox="0 0 60 20">
              <path d="M0,15 Q15,18 30,8 T60,4" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Affected Population */}
        <div className="bg-white/95 dark:bg-slate-900/85 rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-text-tertiary">Affected Population</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1 tracking-tight">
                {totalExposedPop}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
            <span className="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400 font-bold font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↑ 8%</span>
              <span className="text-text-tertiary font-normal">estimated</span>
            </span>
            <svg className="w-16 h-5 text-amber-600 dark:text-amber-400 stroke-current fill-none" viewBox="0 0 60 20">
              <path d="M0,16 Q15,14 30,12 T60,5" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 3: Resource Demand */}
        <div className="bg-white/95 dark:bg-slate-900/85 rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-text-tertiary">Resource Demand</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1 tracking-tight">
                848K
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30 flex items-center justify-center shadow-sm">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
            <span className="flex items-center space-x-1 text-xs text-blue-600 dark:text-sky-400 font-bold font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↑ 15%</span>
              <span className="text-text-tertiary font-normal">units (all types)</span>
            </span>
            <svg className="w-16 h-5 text-blue-600 dark:text-sky-400 stroke-current fill-none" viewBox="0 0 60 20">
              <path d="M0,18 Q15,10 30,13 T60,3" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 4: Available Inventory */}
        <div className="bg-white/95 dark:bg-slate-900/85 rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-text-tertiary">Available Inventory</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1 tracking-tight">
                {totalStockpile}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 flex items-center justify-center shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
            <span className="flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↑ 4%</span>
              <span className="text-text-tertiary font-normal">units (all depots)</span>
            </span>
            <svg className="w-16 h-5 text-emerald-600 dark:text-emerald-400 stroke-current fill-none" viewBox="0 0 60 20">
              <path d="M0,14 Q20,16 40,8 T60,5" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 5: Resource Shortage */}
        <div className="bg-white/95 dark:bg-slate-900/85 rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle relative overflow-hidden group col-span-2 sm:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-text-tertiary">Resource Shortage</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1 tracking-tight">
                236K
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
            <span className="flex items-center space-x-1 text-xs text-purple-600 dark:text-purple-400 font-bold font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>↑ 18%</span>
              <span className="text-text-tertiary font-normal">units (all types)</span>
            </span>
            <svg className="w-16 h-5 text-purple-600 dark:text-purple-400 stroke-current fill-none" viewBox="0 0 60 20">
              <path d="M0,17 Q15,11 30,14 T60,6" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE (3-COLUMN LAYOUT: Recent Incidents | Map | Selected Incident Inspector) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* COLUMN 1 (Left): Recent Incidents Panel (Width: 3/12) */}
        <div className="lg:col-span-3 bg-white/95 dark:bg-slate-900/85 rounded-2xl flex flex-col min-h-0 shadow-sm border border-border-subtle overflow-hidden">
          <div className="p-3.5 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Recent Incidents
            </h2>
            <Link
              to="/events"
              className="text-xs text-blue-600 dark:text-sky-400 hover:underline flex items-center space-x-1 font-bold"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Severity Filter Pills */}
          <div className="px-3 py-2 flex items-center space-x-1.5 overflow-x-auto border-b border-border-subtle shrink-0">
            {(["All", "Critical", "High", "Moderate", "Low"] as const).map((filter) => {
              const count = severityCounts[filter];
              const isSelected = selectedFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center space-x-1 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600"
                      : "bg-slate-100 dark:bg-slate-800 text-text-secondary hover:text-text-primary border border-border-subtle"
                  }`}
                >
                  <span>{filter}</span>
                  <span className="opacity-90 font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Incidents List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredIncidents.length === 0 ? (
              <div className="p-6 text-center text-text-tertiary text-xs">
                No incidents match this severity filter.
              </div>
            ) : (
              filteredIncidents.slice(0, 30).map((ev) => {
                const isSelected = ev.id === selectedEventId;
                const severity = getSeverityLevel(ev);
                const timeAgo = "2 hours ago";

                return (
                  <div
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-blue-50/90 dark:bg-sky-500/15 border-blue-600 dark:border-sky-500 text-text-primary shadow-sm"
                        : "bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-border-subtle text-text-secondary hover:text-text-primary shadow-sm"
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-surface-3 flex items-center justify-center shrink-0 mt-0.5 border border-border-subtle">
                        {getDisasterIcon(ev.event_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-text-primary truncate">
                            {ev.title}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                              severity === "Critical"
                                ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                                : severity === "High"
                                ? "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30"
                                : severity === "Moderate"
                                ? "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                            }`}
                          >
                            {severity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-text-tertiary">
                          <span className="truncate font-medium">{ev.country || "India Region"}</span>
                          <span className="font-mono shrink-0">{timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2 (Center): Geospatial Command Map (Width: 6/12) */}
        <div className="lg:col-span-6 bg-white/95 dark:bg-slate-900/85 rounded-2xl flex flex-col min-h-[420px] relative shadow-sm border border-border-subtle overflow-hidden">
          {/* Map Top Bar Controls */}
          <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
            {/* Search location bar */}
            <div className="bg-white/95 dark:bg-slate-900/95 rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs shadow-md pointer-events-auto border border-border-strong w-48">
              <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-text-primary focus:outline-none font-medium"
                placeholder="Search location..."
              />
            </div>

            {/* Basemap Switcher Buttons */}
            <div className="bg-white/95 dark:bg-slate-900/95 rounded-xl p-1 flex items-center space-x-1 shadow-md pointer-events-auto border border-border-strong text-xs">
              {(["osm", "dark", "satellite"] as const).map((bm) => (
                <button
                  key={bm}
                  onClick={() => setBasemap(bm)}
                  className={`px-2.5 py-1 rounded-lg capitalize font-bold transition ${
                    basemap === bm
                      ? "bg-blue-600 text-white shadow-sm dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600"
                      : "text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {bm === "osm" ? "Map" : bm === "dark" ? "Terrain" : "Satellite"}
                </button>
              ))}
            </div>
          </div>

          {/* Leaflet Map Engine strictly centered on India */}
          <div className="w-full h-full min-h-[420px] relative">
            <MapContainer
              center={[22.5937, 78.9629]}
              zoom={5}
              minZoom={4}
              maxZoom={14}
              scrollWheelZoom={true}
              className="h-full w-full"
              style={{ minHeight: "420px" }}
            >
              <MapController coords={activeCoords} isUserSelected={isUserSelected} />

              {/* Dynamic Basemap Layers */}
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
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              )}

              {/* Severity Grid Cells Overlay */}
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
                        fillOpacity: 0.25,
                        weight: 1.2,
                      }}
                    />
                  );
                })}

              {/* Impact Footprints (Selected Event) */}
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
                        color: "#D97706",
                        fillColor: "#D97706",
                        fillOpacity: 0.15,
                        weight: 2,
                        dashArray: "4, 6",
                      }}
                    />
                  );
                })}

              {/* Strategic Relief Depots */}
              {showDepots &&
                depots.map((d) => (
                  <Marker key={d.id} position={[d.latitude, d.longitude]} icon={depotIcon}>
                    <Popup>
                      <div className="p-1 text-xs space-y-1">
                        <div className="font-bold text-blue-600 dark:text-sky-400 flex items-center space-x-1">
                          <Warehouse className="w-3.5 h-3.5" />
                          <span>{d.name}</span>
                        </div>
                        <p className="text-[11px] text-text-secondary">{d.address || "Regional Depot"}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* Disaster Incident Markers */}
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
                      radius={isSelected ? 10 : 7}
                      pathOptions={{
                        color: isSelected ? "#2563EB" : color,
                        fillColor: color,
                        fillOpacity: 0.85,
                        weight: isSelected ? 3 : 1.5,
                      }}
                      eventHandlers={{
                        click: () => handleSelectEvent(ev.id),
                      }}
                    >
                      <Popup>
                        <div className="p-1 space-y-1 text-xs font-sans">
                          <div className="font-bold text-text-primary">{ev.title}</div>
                          <div className="text-[11px] text-text-secondary capitalize">{ev.event_type}</div>
                          <SeverityBadge level={ev.alert_level || "Active"} score={ev.magnitude ?? undefined} />
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
            </MapContainer>

            {/* Floating Severity Level Legend (Bottom Left) */}
            <div className="absolute bottom-3 left-3 z-20 bg-white/95 dark:bg-slate-900/95 rounded-xl p-3 shadow-lg border border-border-strong text-xs space-y-2 w-44 pointer-events-auto">
              <div className="font-bold text-text-primary text-[11px] uppercase tracking-wider">
                Severity Level
              </div>
              <div className="space-y-1.5 text-[11px] text-text-secondary font-medium">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span>Critical (≥75)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
                  <span>High (50–74)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Moderate (25–49)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Low (&lt;25)</span>
                </div>
              </div>
            </div>

            {/* Floating Map Layers Toggle Card (Bottom Right) */}
            <div className="absolute bottom-3 right-3 z-20 bg-white/95 dark:bg-slate-900/95 rounded-xl p-3 shadow-lg border border-border-strong text-xs space-y-2 w-48 pointer-events-auto">
              <div className="font-bold text-text-primary text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                <span>Map Layers</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-text-secondary font-medium">
                <label className="flex items-center space-x-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={showFootprints}
                    onChange={(e) => setShowFootprints(e.target.checked)}
                    className="rounded bg-surface-2 border-border-strong text-blue-600 focus:ring-0"
                  />
                  <span>Impact Footprints</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded bg-surface-2 border-border-strong text-blue-600 focus:ring-0"
                  />
                  <span>Severity Grid</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={showDepots}
                    onChange={(e) => setShowDepots(e.target.checked)}
                    className="rounded bg-surface-2 border-border-strong text-blue-600 focus:ring-0"
                  />
                  <span>Depots</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={showEvents}
                    onChange={(e) => setShowEvents(e.target.checked)}
                    className="rounded bg-surface-2 border-border-strong text-blue-600 focus:ring-0"
                  />
                  <span>Events</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3 (Right): Selected Incident Inspector (Width: 3/12) */}
        <div className="lg:col-span-3 bg-white/95 dark:bg-slate-900/85 rounded-2xl flex flex-col min-h-0 shadow-sm border border-border-subtle overflow-hidden">
          {activeEventObj ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              {/* Disaster Banner Preview */}
              <div className="relative h-28 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-sky-950 flex items-end p-3.5 overflow-hidden shrink-0 border-b border-border-subtle">
                <div className="relative z-10 w-full flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm">
                      {getSeverityLevel(activeEventObj)}
                    </span>
                    <h3 className="text-sm font-bold text-text-primary tracking-tight truncate max-w-[200px] mt-1">
                      {activeEventObj.title}
                    </h3>
                    <p className="text-[11px] text-text-secondary font-medium">
                      {activeEventObj.country || "Northern Disaster Zone"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status and Report Identifiers */}
              <div className="p-3 border-b border-border-subtle flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-text-tertiary font-medium">Report ID</div>
                  <div className="font-mono font-bold text-text-primary">
                    RPT-{activeEventObj.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary font-medium">Status</div>
                  <span className="inline-block text-[10px] font-bold text-blue-700 dark:text-sky-400 bg-blue-50 dark:bg-sky-500/15 border border-blue-200 dark:border-sky-500/30 px-2 py-0.5 rounded-full">
                    Under Assessment
                  </span>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="flex border-b border-border-subtle px-2 shrink-0">
                {(["Overview", "Resource Needs", "Affected Areas", "History"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600 dark:border-sky-400 dark:text-sky-400"
                        : "border-transparent text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-3 space-y-4 flex-1">
                {activeTab === "Overview" && (
                  <>
                    {/* Description */}
                    <div>
                      <h4 className="text-[11px] font-bold uppercase text-text-tertiary tracking-wider mb-1">
                        Description
                      </h4>
                      <p className="text-xs text-text-secondary leading-relaxed font-medium">
                        {activeEventObj.description ||
                          "Severe disaster impact reported across the sector. Rapid mobilization of relief materials and tactical logistics underway."}
                      </p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-subtle text-center">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle">
                        <div className="text-[10px] text-text-tertiary font-medium">Affected Pop</div>
                        <div className="font-mono font-bold text-xs text-text-primary mt-0.5">
                          125,000
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle">
                        <div className="text-[10px] text-text-tertiary font-medium">Households</div>
                        <div className="font-mono font-bold text-xs text-text-primary mt-0.5">
                          25,000
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle">
                        <div className="text-[10px] text-text-tertiary font-medium">Area</div>
                        <div className="font-mono font-bold text-xs text-text-primary mt-0.5">
                          450 km²
                        </div>
                      </div>
                    </div>

                    {/* Resource Demand (Predicted) 4-Tile Grid */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase text-text-tertiary tracking-wider">
                          Resource Demand (Predicted)
                        </h4>
                        <Link
                          to="/predictions"
                          className="text-[11px] text-blue-600 dark:text-sky-400 hover:underline flex items-center space-x-1 font-bold"
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Food Packets */}
                        <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                          <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            <Package className="w-3.5 h-3.5" />
                            <span>Food Packets</span>
                          </div>
                          <div className="font-mono font-bold text-sm text-text-primary">
                            {activePredictions.food.toLocaleString()}
                          </div>
                        </div>

                        {/* Water */}
                        <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                          <div className="flex items-center space-x-1.5 text-blue-600 dark:text-sky-400 text-xs font-bold">
                            <Droplets className="w-3.5 h-3.5" />
                            <span>Water (Litres)</span>
                          </div>
                          <div className="font-mono font-bold text-sm text-text-primary">
                            {activePredictions.water.toLocaleString()}
                          </div>
                        </div>

                        {/* Medical Kits */}
                        <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                          <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 text-xs font-bold">
                            <BriefcaseMedical className="w-3.5 h-3.5" />
                            <span>Medical Kits</span>
                          </div>
                          <div className="font-mono font-bold text-sm text-text-primary">
                            {activePredictions.medical.toLocaleString()}
                          </div>
                        </div>

                        {/* Shelter Spaces */}
                        <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                          <div className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold">
                            <Home className="w-3.5 h-3.5" />
                            <span>Shelter Spaces</span>
                          </div>
                          <div className="font-mono font-bold text-sm text-text-primary">
                            {activePredictions.shelter.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Current Availability Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-text-primary">Current Availability</span>
                        <Link
                          to="/inventory"
                          className="text-[11px] text-blue-600 dark:text-sky-400 hover:underline font-bold"
                        >
                          View Inventory →
                        </Link>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                        <div className="bg-emerald-600 dark:bg-emerald-500 h-full w-[68%]" />
                        <div className="bg-red-600 dark:bg-red-500 h-full w-[32%]" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold pt-0.5">
                        <span className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>Available: 520K</span>
                        </span>
                        <span className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          <span>Shortage: 236K</span>
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "Resource Needs" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-text-secondary font-medium">
                      MultiOutput Random Forest quantile estimation (3-day surge horizon) recommends priority logistics dispatches for food packets and water filtration assets.
                    </p>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2 border border-border-subtle font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary font-medium">Surge Horizon:</span>
                        <span className="text-text-primary font-bold">72 Hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary font-medium">Confidence Interval:</span>
                        <span className="text-text-primary font-bold">90% Quantile</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary font-medium">Logistics Route:</span>
                        <span className="text-blue-600 dark:text-sky-400 font-bold">Primary Highway NH-7</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "Affected Areas" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-text-secondary font-medium">
                      Geographic vulnerability analysis indicates low terrain elevation in sector grid clusters.
                    </p>
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle flex justify-between items-center">
                        <span className="font-bold text-text-primary">Northern River Basin</span>
                        <span className="text-red-600 dark:text-red-400 font-bold">Critical Level 4</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle flex justify-between items-center">
                        <span className="font-bold text-text-primary">Urban Outskirts Grid</span>
                        <span className="text-orange-600 dark:text-orange-400 font-bold">High Level 3</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "History" && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-text-primary">Initial Ingestion Recorded</div>
                        <div className="text-[10px] text-text-tertiary font-mono">GDACS Seismic &amp; Flood Monitor</div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-text-primary">ML Demand Inference Run</div>
                        <div className="text-[10px] text-text-tertiary font-mono">Random Forest Regressor v1.2</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-text-tertiary text-xs">
              Select an incident from the feed to inspect real impact telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
