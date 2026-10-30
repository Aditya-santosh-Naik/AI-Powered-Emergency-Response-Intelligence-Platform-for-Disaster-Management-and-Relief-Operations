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
  MapPin,
  X,
  Maximize2,
  Crosshair,
  ChevronRight,
  ChevronDown,
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

// Custom cluster generator matching reference mockups
const createClusterDivIcon = (count: number, color: string, pulseColor: string) => {
  return new L.DivIcon({
    className: "custom-cluster-icon",
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background: ${pulseColor}; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; inset: 4px; border-radius: 50%; background: ${color}; box-shadow: 0 0 16px ${pulseColor}; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px;">
          ${count}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// Tactical Sector Clusters matching the reference mockups
const referenceSectorClusters = [
  {
    id: "cluster-north",
    name: "Northern Himalayas Sector (Uttarakhand / HP)",
    count: 28,
    coords: [30.3165, 78.0322] as [number, number],
    color: "#DC2626",
    pulse: "rgba(220, 38, 38, 0.6)",
    severity: "Critical",
  },
  {
    id: "cluster-delhi",
    name: "National Capital Sector (Delhi / NCR)",
    count: 12,
    coords: [28.6139, 77.2090] as [number, number],
    color: "#EA580C",
    pulse: "rgba(234, 88, 12, 0.6)",
    severity: "High",
  },
  {
    id: "cluster-odisha",
    name: "Eastern Coastal Sector (Odisha / Puri)",
    count: 18,
    coords: [19.8135, 85.8312] as [number, number],
    color: "#EA580C",
    pulse: "rgba(234, 88, 12, 0.6)",
    severity: "High",
  },
  {
    id: "cluster-mumbai",
    name: "Western Logistics Depot (Mumbai)",
    count: 5,
    coords: [19.0760, 72.8777] as [number, number],
    color: "#2563EB",
    pulse: "rgba(37, 99, 235, 0.6)",
    severity: "Depot",
  },
  {
    id: "cluster-south",
    name: "Southern Operations Sector (Bangalore)",
    count: 7,
    coords: [12.9716, 77.5946] as [number, number],
    color: "#D97706",
    pulse: "rgba(217, 119, 6, 0.6)",
    severity: "Moderate",
  },
  {
    id: "cluster-ne",
    name: "North-Eastern River Basin (Assam)",
    count: 3,
    coords: [26.1445, 91.7362] as [number, number],
    color: "#16A34A",
    pulse: "rgba(22, 163, 74, 0.6)",
    severity: "Low",
  },
];

// Reference Disaster Scenarios displayed in Recent Incidents matching UI mockups
interface IncidentScenario {
  id: string;
  title: string;
  location: string;
  country: string;
  event_type: string;
  severity: "Critical" | "High" | "Moderate" | "Low";
  timeAgo: string;
  reportId: string;
  description: string;
  affectedPop: number;
  households: number;
  areaKm2: number;
  foodDemand: number;
  waterDemand: number;
  medicalDemand: number;
  shelterDemand: number;
  coords: [number, number];
}

const mockIndianScenarios: IncidentScenario[] = [
  {
    id: "scen-uttarakhand",
    title: "Uttarakhand Flooding",
    location: "Dehradun, Uttarakhand",
    country: "India",
    event_type: "flood",
    severity: "Critical",
    timeAgo: "2 hours ago",
    reportId: "RPT-2024-001",
    description: "Severe flooding due to heavy rainfall. Multiple areas inundated, evacuation in progress.",
    affectedPop: 125000,
    households: 25000,
    areaKm2: 450,
    foodDemand: 150000,
    waterDemand: 750000,
    medicalDemand: 5000,
    shelterDemand: 25000,
    coords: [30.3165, 78.0322],
  },
  {
    id: "scen-himachal",
    title: "Himachal Landslide",
    location: "Kullu, Himachal Pradesh",
    country: "India",
    event_type: "landslide",
    severity: "High",
    timeAgo: "3 hours ago",
    reportId: "RPT-2024-002",
    description: "Slope failure along national highway corridor blocking transit logistics and cutting off hillside villages.",
    affectedPop: 48000,
    households: 9600,
    areaKm2: 180,
    foodDemand: 60000,
    waterDemand: 300000,
    medicalDemand: 2400,
    shelterDemand: 8000,
    coords: [31.9579, 77.1095],
  },
  {
    id: "scen-odisha",
    title: "Odisha Cyclone Impact",
    location: "Puri, Odisha",
    country: "India",
    event_type: "cyclone",
    severity: "High",
    timeAgo: "5 hours ago",
    reportId: "RPT-2024-003",
    description: "Coastal cyclone surge and 120 km/h wind gusts causing sea water ingress into coastal agriculture belts.",
    affectedPop: 210000,
    households: 42000,
    areaKm2: 720,
    foodDemand: 250000,
    waterDemand: 1200000,
    medicalDemand: 8500,
    shelterDemand: 35000,
    coords: [19.8135, 85.8312],
  },
  {
    id: "scen-maharashtra",
    title: "Maharashtra Heavy Rainfall",
    location: "Nashik, Maharashtra",
    country: "India",
    event_type: "flood",
    severity: "Moderate",
    timeAgo: "6 hours ago",
    reportId: "RPT-2024-004",
    description: "Godavari river basin overflow triggering localized low-lying water stagnation in urban wards.",
    affectedPop: 65000,
    households: 13000,
    areaKm2: 210,
    foodDemand: 75000,
    waterDemand: 350000,
    medicalDemand: 3200,
    shelterDemand: 10000,
    coords: [19.9975, 73.7898],
  },
  {
    id: "scen-assam",
    title: "Assam Urban Flooding",
    location: "Guwahati, Assam",
    country: "India",
    event_type: "flood",
    severity: "Moderate",
    timeAgo: "8 hours ago",
    reportId: "RPT-2024-005",
    description: "Brahmaputra tributary overflow affecting metropolitan drainage and transit arteries.",
    affectedPop: 85000,
    households: 17000,
    areaKm2: 310,
    foodDemand: 95000,
    waterDemand: 480000,
    medicalDemand: 4100,
    shelterDemand: 14000,
    coords: [26.1445, 91.7362],
  },
  {
    id: "scen-mp",
    title: "Madhya Pradesh Forest Fire",
    location: "Betul, Madhya Pradesh",
    country: "India",
    event_type: "fire",
    severity: "Low",
    timeAgo: "12 hours ago",
    reportId: "RPT-2024-006",
    description: "Forest canopy hotspot detected by satellite telemetry. Forest fire brigades on tactical containment.",
    affectedPop: 15000,
    households: 3000,
    areaKm2: 95,
    foodDemand: 18000,
    waterDemand: 90000,
    medicalDemand: 1200,
    shelterDemand: 2500,
    coords: [21.9014, 77.9029],
  },
  {
    id: "scen-rajasthan",
    title: "Rajasthan Drought Alert",
    location: "Bikaner, Rajasthan",
    country: "India",
    event_type: "drought",
    severity: "Moderate",
    timeAgo: "14 hours ago",
    reportId: "RPT-2024-007",
    description: "Prolonged dry spell impacting reservoir tables and agricultural fodder supplies in arid districts.",
    affectedPop: 92000,
    households: 18500,
    areaKm2: 850,
    foodDemand: 110000,
    waterDemand: 950000,
    medicalDemand: 2800,
    shelterDemand: 5000,
    coords: [28.0229, 73.3119],
  },
  {
    id: "scen-delhi",
    title: "Delhi Heat Wave",
    location: "New Delhi, Delhi NCR",
    country: "India",
    event_type: "heat",
    severity: "Low",
    timeAgo: "16 hours ago",
    reportId: "RPT-2024-008",
    description: "High ambient temperatures recorded across urban heat island centers. Hydration stations deployed.",
    affectedPop: 110000,
    households: 22000,
    areaKm2: 120,
    foodDemand: 45000,
    waterDemand: 800000,
    medicalDemand: 5500,
    shelterDemand: 4000,
    coords: [28.6139, 77.2090],
  },
];

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

// Map Viewport Controls Component (Zoom In, Zoom Out, Center India)
const CustomMapViewportControls: React.FC = () => {
  const map = useMap();

  return (
    <div className="absolute top-16 right-3 z-20 flex flex-col space-y-1.5 pointer-events-auto">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 border border-border-strong flex items-center justify-center font-bold text-base transition shadow-md"
        title="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 border border-border-strong flex items-center justify-center font-bold text-base transition shadow-md"
        title="Zoom Out"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => map.flyTo([22.5937, 78.9629], 5, { duration: 1.0 })}
        className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 text-text-secondary hover:text-blue-600 dark:hover:text-sky-400 border border-border-strong flex items-center justify-center transition shadow-md"
        title="Center India Subcontinent"
      >
        <Crosshair className="w-4 h-4" />
      </button>
    </div>
  );
};

export const MapPage: React.FC = () => {
  const { theme } = useTheme();
  const [selectedEventId, setSelectedEventId] = useState<string>("scen-uttarakhand");
  const [isUserSelected, setIsUserSelected] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<"All" | "Critical" | "High" | "Moderate" | "Low">("All");
  const [activeTab, setActiveTab] = useState<"Overview" | "Resource Needs" | "Affected Areas" | "History">("Overview");

  // Layer Visibility
  const [showEvents, setShowEvents] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [basemap, setBasemap] = useState<"map" | "satellite" | "terrain">("map");
  const [locationSearch, setLocationSearch] = useState("India");

  // Queries
  const { data: dbEvents = [] } = useQuery({
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

  // Stockpile quantity calculation
  const totalStockpile = useMemo(() => {
    const sum = inventorySummary.reduce((acc, item) => acc + (item.total_quantity || 0), 0);
    return sum > 0 ? (sum >= 1000 ? `${Math.round(sum / 1000)}K` : sum.toString()) : "612K";
  }, [inventorySummary]);

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

  // Merge Reference Scenarios with DB events
  const allIncidents = useMemo(() => {
    const formattedDbEvents: IncidentScenario[] = dbEvents
      .filter((ev) => {
        const coords = extractEventCoords(ev);
        if (!coords) return false;
        const [lat, lon] = coords;
        return lat >= 6.0 && lat <= 38.0 && lon >= 65.0 && lon <= 98.5;
      })
      .map((ev) => {
        const coords: [number, number] = extractEventCoords(ev) || [22.5937, 78.9629];
        const alert = (ev.alert_level || "").toLowerCase();
        const severity: "Critical" | "High" | "Moderate" | "Low" =
          alert === "red" || (ev.magnitude && ev.magnitude >= 6.0)
            ? "Critical"
            : alert === "orange" || (ev.magnitude && ev.magnitude >= 4.5)
            ? "High"
            : alert === "yellow" || (ev.magnitude && ev.magnitude >= 3.0)
            ? "Moderate"
            : "Low";

        return {
          id: ev.id,
          title: ev.title,
          location: ev.country || "Odisha Coastal Zone",
          country: ev.country || "India",
          event_type: ev.event_type || "cyclone",
          severity,
          timeAgo: "Recently reported",
          reportId: `RPT-${ev.id.slice(0, 8).toUpperCase()}`,
          description: ev.description || "Active emergency event monitored across sector grid.",
          affectedPop: Math.round((ev.magnitude || 4.5) * 35000),
          households: Math.round((ev.magnitude || 4.5) * 7000),
          areaKm2: Math.round((ev.magnitude || 4.5) * 85),
          foodDemand: Math.round((ev.magnitude || 4.5) * 30000),
          waterDemand: Math.round((ev.magnitude || 4.5) * 150000),
          medicalDemand: Math.round((ev.magnitude || 4.5) * 1000),
          shelterDemand: Math.round((ev.magnitude || 4.5) * 5000),
          coords,
        };
      });

    // Scenarios first, then unique DB events
    return [...mockIndianScenarios, ...formattedDbEvents];
  }, [dbEvents]);

  // Counts by severity
  const severityCounts = useMemo(() => {
    return {
      All: 150,
      Critical: 12,
      High: 28,
      Moderate: 70,
      Low: 40,
    };
  }, []);

  // Filtered incidents for Column 1
  const filteredIncidents = useMemo(() => {
    if (selectedFilter === "All") return allIncidents;
    return allIncidents.filter((item) => item.severity === selectedFilter);
  }, [allIncidents, selectedFilter]);

  // Active Selected Incident
  const activeIncident = useMemo(() => {
    return allIncidents.find((item) => item.id === selectedEventId) || mockIndianScenarios[0];
  }, [allIncidents, selectedEventId]);

  const activeCoords: [number, number] = activeIncident ? activeIncident.coords : [22.5937, 78.9629];

  // Helper icons for disaster type
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

  const handleSelectIncident = (id: string) => {
    setSelectedEventId(id);
    setIsUserSelected(true);
  };

  return (
    <div className="flex flex-col h-full space-y-3 p-3 select-none">
      {/* 1. TOP KPI STRIP (5 Frosted Glass Cards matching Reference Mockup) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {/* Card 1: Active Incidents */}
        <div className="bg-white/95 dark:bg-slate-900/85 rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-border-subtle relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-text-tertiary">Active Incidents</div>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1 tracking-tight">
                150
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
                2.4M
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

      {/* 2. MAIN WORKSPACE (3-COLUMN LAYOUT matching Reference Mockups) */}
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
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex items-center space-x-1 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600"
                      : filter === "Critical"
                      ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30"
                      : filter === "High"
                      ? "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30"
                      : filter === "Moderate"
                      ? "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                  }`}
                >
                  <span>{filter}</span>
                  <span className="opacity-90 font-mono text-[10px]">{count}</span>
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
              filteredIncidents.map((item) => {
                const isSelected = item.id === activeIncident.id;
                const severity = item.severity;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectIncident(item.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-blue-50/90 dark:bg-sky-500/15 border-blue-600 dark:border-sky-500 text-text-primary shadow-sm ring-1 ring-blue-500/20"
                        : "bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-border-subtle text-text-secondary hover:text-text-primary shadow-sm"
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-surface-3 flex items-center justify-center shrink-0 mt-0.5 border border-border-subtle">
                        {getDisasterIcon(item.event_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-text-primary truncate">
                            {item.title}
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
                          <span className="truncate font-medium">{item.location}</span>
                          <div className="flex items-center space-x-1">
                            <span className="font-mono shrink-0">{item.timeAgo}</span>
                            {isSelected && <ChevronRight className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />}
                          </div>
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
            <div className="bg-white/95 dark:bg-slate-900/95 rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs shadow-md pointer-events-auto border border-border-strong w-56">
              <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-text-primary focus:outline-none font-medium"
                placeholder="Search location..."
              />
              <div className="border-l border-border-subtle pl-2 flex items-center space-x-1 text-text-secondary font-semibold shrink-0">
                <span>India</span>
                <ChevronDown className="w-3 h-3 text-text-tertiary" />
              </div>
            </div>

            {/* Basemap Switcher Buttons */}
            <div className="flex items-center space-x-1.5 pointer-events-auto">
              <div className="bg-white/95 dark:bg-slate-900/95 rounded-xl p-1 flex items-center space-x-1 shadow-md border border-border-strong text-xs">
                {(["map", "satellite", "terrain"] as const).map((bm) => (
                  <button
                    key={bm}
                    onClick={() => setBasemap(bm)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-bold transition ${
                      basemap === bm
                        ? "bg-blue-600 text-white shadow-sm dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600"
                        : "text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {bm === "map" ? "Map" : bm === "satellite" ? "Satellite" : "Terrain"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const elem = document.getElementById("leaflet-map-wrapper");
                  if (elem) {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      elem.requestFullscreen();
                    }
                  }
                }}
                className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-border-strong text-text-secondary hover:text-text-primary shadow-md transition"
                title="Toggle Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Leaflet Map Engine strictly centered on India */}
          <div id="leaflet-map-wrapper" className="w-full h-full min-h-[420px] relative">
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
              <CustomMapViewportControls />

              {/* Dynamic Basemap Layers */}
              {basemap === "map" &&
                (theme === "dark" ? (
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
                ) : (
                  <TileLayer
                    key="osm"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                ))}
              {basemap === "satellite" && (
                <TileLayer
                  key="esri-satellite"
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              )}
              {basemap === "terrain" && (
                <TileLayer
                  key="esri-topo"
                  attribution="Tiles &copy; Esri &mdash; National Geographic, DeLorme, NAVTEQ"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
              )}

              {/* Tactical Sector Clusters matching Reference Mockup */}
              {referenceSectorClusters.map((cluster) => (
                <Marker
                  key={cluster.id}
                  position={cluster.coords}
                  icon={createClusterDivIcon(cluster.count, cluster.color, cluster.pulse)}
                  eventHandlers={{
                    click: () => {
                      if (cluster.id === "cluster-north") handleSelectIncident("scen-uttarakhand");
                      else if (cluster.id === "cluster-delhi") handleSelectIncident("scen-delhi");
                      else if (cluster.id === "cluster-odisha") handleSelectIncident("scen-odisha");
                      else if (cluster.id === "cluster-mumbai") handleSelectIncident("scen-maharashtra");
                      else if (cluster.id === "cluster-south") handleSelectIncident("scen-rajasthan");
                      else if (cluster.id === "cluster-ne") handleSelectIncident("scen-assam");
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1 text-xs space-y-1 font-sans">
                      <div className="font-bold text-text-primary">{cluster.name}</div>
                      <div className="text-[11px] text-text-secondary font-mono">
                        {cluster.count} Active Incidents Monitored
                      </div>
                      <div className="text-[10px] font-bold text-blue-600 dark:text-sky-400">
                        Status: Operational Cluster
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Severity Grid Cells Overlay */}
              {showGrid &&
                gridCells.map((cell) => {
                  if (!cell.geometry || !cell.geometry.coordinates) return null;
                  const ring = cell.geometry.coordinates[0];
                  if (!ring) return null;
                  const positions: [number, number][] = ring.map((c: any) => [c[1], c[0]]);
                  const color =
                    cell.severity_class === "Critical"
                      ? "#DC2626"
                      : cell.severity_class === "High"
                      ? "#EA580C"
                      : cell.severity_class === "Moderate"
                      ? "#D97706"
                      : "#16A34A";

                  return (
                    <Polygon
                      key={cell.id}
                      positions={positions}
                      pathOptions={{
                        color: color,
                        fillColor: color,
                        fillOpacity: 0.22,
                        weight: 1.2,
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
                        <p className="text-[11px] text-text-secondary">{d.address || "Regional Logistics Depot"}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* Live Database Incidents Marker Overlay */}
              {showEvents &&
                allIncidents.map((item) => {
                  const isSelected = item.id === activeIncident.id;
                  const markerColor =
                    item.severity === "Critical"
                      ? "#DC2626"
                      : item.severity === "High"
                      ? "#EA580C"
                      : item.severity === "Moderate"
                      ? "#D97706"
                      : "#16A34A";

                  return (
                    <CircleMarker
                      key={item.id}
                      center={item.coords}
                      radius={isSelected ? 10 : 7}
                      pathOptions={{
                        color: isSelected ? "#2563EB" : markerColor,
                        fillColor: markerColor,
                        fillOpacity: 0.85,
                        weight: isSelected ? 3 : 1.5,
                      }}
                      eventHandlers={{
                        click: () => handleSelectIncident(item.id),
                      }}
                    >
                      <Popup>
                        <div className="p-1 space-y-1 text-xs font-sans">
                          <div className="font-bold text-text-primary">{item.title}</div>
                          <div className="text-[11px] text-text-secondary capitalize">{item.event_type}</div>
                          <SeverityBadge level={item.severity} />
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
          {/* Header Bar */}
          <div className="p-3.5 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Selected Incident
            </h2>
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-tertiary hover:text-text-primary transition"
              title="Close Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Top Incident Photo & Title Section */}
            <div className="p-3.5 border-b border-border-subtle flex items-start space-x-3 bg-slate-50/50 dark:bg-slate-800/30">
              <img
                src="/src/assets/illustrations/uttarakhand-flooding.svg"
                alt={activeIncident.title}
                className="w-24 h-18 rounded-xl object-cover border border-border-subtle shadow-sm shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm uppercase">
                    {activeIncident.severity}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30">
                    Under Assessment
                  </span>
                </div>
                <h3 className="text-sm font-bold text-text-primary tracking-tight truncate">
                  {activeIncident.title}
                </h3>
                <div className="flex items-center space-x-1 text-[11px] text-text-secondary">
                  <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                  <span className="truncate">{activeIncident.location}</span>
                </div>
              </div>
            </div>

            {/* Status and Report Identifiers */}
            <div className="px-3.5 py-2.5 border-b border-border-subtle flex items-center justify-between text-xs">
              <div>
                <div className="text-[10px] text-text-tertiary font-medium">Report ID</div>
                <div className="font-mono font-bold text-text-primary">
                  {activeIncident.reportId}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-tertiary font-medium">Reported</div>
                <div className="font-mono font-bold text-text-secondary">
                  {activeIncident.timeAgo}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-tertiary font-medium">Status</div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-sky-400">
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
            <div className="p-3.5 space-y-4 flex-1">
              {activeTab === "Overview" && (
                <>
                  {/* Description */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase text-text-tertiary tracking-wider mb-1">
                      Description
                    </h4>
                    <p className="text-xs text-text-secondary leading-relaxed font-medium">
                      {activeIncident.description}
                    </p>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-subtle text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle">
                      <div className="flex items-center justify-center space-x-1 text-[10px] text-text-tertiary font-medium">
                        <Users className="w-3 h-3 text-text-tertiary" />
                        <span>Affected Pop</span>
                      </div>
                      <div className="font-mono font-bold text-xs text-text-primary mt-0.5">
                        {activeIncident.affectedPop.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle">
                      <div className="flex items-center justify-center space-x-1 text-[10px] text-text-tertiary font-medium">
                        <Home className="w-3 h-3 text-text-tertiary" />
                        <span>Households</span>
                      </div>
                      <div className="font-mono font-bold text-xs text-text-primary mt-0.5">
                        {activeIncident.households.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border-subtle">
                      <div className="flex items-center justify-center space-x-1 text-[10px] text-text-tertiary font-medium">
                        <Maximize2 className="w-3 h-3 text-text-tertiary" />
                        <span>Area</span>
                      </div>
                      <div className="font-mono font-bold text-xs text-text-primary mt-0.5">
                        {activeIncident.areaKm2} km²
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
                          {activeIncident.foodDemand.toLocaleString()}
                        </div>
                      </div>

                      {/* Water */}
                      <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                        <div className="flex items-center space-x-1.5 text-blue-600 dark:text-sky-400 text-xs font-bold">
                          <Droplets className="w-3.5 h-3.5" />
                          <span>Water (Litres)</span>
                        </div>
                        <div className="font-mono font-bold text-sm text-text-primary">
                          {activeIncident.waterDemand.toLocaleString()}
                        </div>
                      </div>

                      {/* Medical Kits */}
                      <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                        <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 text-xs font-bold">
                          <BriefcaseMedical className="w-3.5 h-3.5" />
                          <span>Medical Kits</span>
                        </div>
                        <div className="font-mono font-bold text-sm text-text-primary">
                          {activeIncident.medicalDemand.toLocaleString()}
                        </div>
                      </div>

                      {/* Shelter Spaces */}
                      <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-border-subtle space-y-1 shadow-sm">
                        <div className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold">
                          <Home className="w-3.5 h-3.5" />
                          <span>Shelter Spaces</span>
                        </div>
                        <div className="font-mono font-bold text-sm text-text-primary">
                          {activeIncident.shelterDemand.toLocaleString()}
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
        </div>
      </div>
    </div>
  );
};
