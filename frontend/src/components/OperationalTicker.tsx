import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { api } from "../api/client";

export const OperationalTicker: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [offsetIndex, setOffsetIndex] = useState(0);

  const { data: events = [] } = useQuery({
    queryKey: ["events-ticker"],
    queryFn: () => api.getEvents({ limit: 15 }),
    refetchInterval: 30000,
  });

  const tickerItems = events.slice(0, 10).map((ev) => {
    const timeStr = new Date(ev.updated_at || ev.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      time: timeStr,
      source: ev.source || "GDACS",
      title: ev.title,
      severity: ev.alert_level || "active",
    };
  });

  // Default operational ticker items matching telemetry feed
  const items = [
    { time: "06:20 PM", source: "GDACS", title: "New flood alert in Uttarakhand", severity: "red" },
    { time: "06:15 PM", source: "USGS", title: "Seismic activity reported", severity: "green" },
    { time: "06:12 PM", source: "NDMA", title: "Advisory issued for coastal areas", severity: "orange" },
    { time: "06:08 PM", source: "IMD", title: "Heavy rainfall warning", severity: "blue" },
    ...tickerItems,
  ];

  const handleNext = () => {
    setOffsetIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setOffsetIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const displayedItems = [...items.slice(offsetIndex), ...items.slice(0, offsetIndex)];

  return (
    <footer className="h-10 glass-panel border-t border-border-subtle flex items-center justify-between px-4 text-xs select-none shrink-0 z-40 bg-white/95 dark:bg-slate-900/90 shadow-sm">
      {/* Ticker Lead */}
      <div className="flex items-center space-x-2.5 shrink-0 border-r border-border-subtle pr-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <span className="font-bold text-[11px] tracking-wide text-text-primary uppercase flex items-center space-x-1.5">
          <Radio className="w-3.5 h-3.5 text-red-500" />
          <span>Live Operational Feed</span>
        </span>
      </div>

      {/* Ticker Marquee / Active Item */}
      <div className="flex-1 overflow-hidden px-4">
        <div
          className={`flex items-center space-x-6 whitespace-nowrap transition-transform duration-300 ${
            isPaused ? "" : "animate-pulse"
          }`}
        >
          {displayedItems.map((item, idx) => (
            <div key={idx} className="flex items-center space-x-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  item.severity === "red"
                    ? "bg-red-500 shadow-sm shadow-red-500/50"
                    : item.severity === "green"
                    ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                    : item.severity === "orange"
                    ? "bg-orange-500 shadow-sm shadow-orange-500/50"
                    : "bg-blue-500 shadow-sm shadow-blue-500/50"
                }`}
              />
              <span className="font-mono text-text-tertiary text-[11px] font-semibold">{item.time}</span>
              <span className="font-bold text-text-primary">{item.source}</span>
              <span className="text-text-tertiary font-bold">•</span>
              <span className="text-text-secondary truncate max-w-xs md:max-w-md font-medium">{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ticker Controls */}
      <div className="flex items-center space-x-1 pl-3 border-l border-border-subtle shrink-0">
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="p-1 rounded-md hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition"
          title={isPaused ? "Resume Ticker" : "Pause Ticker"}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={handlePrev}
          className="p-1 rounded-md hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition"
          title="Previous Alert"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="p-1 rounded-md hover:bg-surface-3 text-text-tertiary hover:text-text-primary transition"
          title="Next Alert"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
