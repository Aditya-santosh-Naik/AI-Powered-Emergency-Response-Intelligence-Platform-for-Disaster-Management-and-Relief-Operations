import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, AlertCircle, CheckCircle } from "lucide-react";
import { api } from "../api/client";

export const StatusStrip: React.FC = () => {
  const { data: runs = [] } = useQuery({
    queryKey: ["ingestion-status"],
    queryFn: api.getIngestionStatus,
    refetchInterval: 15000,
  });

  const sources = ["GDACS", "USGS", "NDMA", "FIRMS"];

  const getSourceRun = (source: string) => {
    return runs.find((r) => r.source.toUpperCase() === source.toUpperCase());
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "Not synced";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-qc-sidebar border-b border-qc-border-subtle px-4 py-2 flex flex-wrap items-center justify-between text-xs text-qc-text-secondary">
      <div className="flex items-center space-x-2">
        <Radio className="h-3.5 w-3.5 text-qc-accent animate-pulse" />
        <span className="font-semibold text-qc-text-primary uppercase tracking-wider text-[11px] font-mono">
          Operational Ingestion Feeds:
        </span>
      </div>

      <div className="flex items-center space-x-4">
        {sources.map((src) => {
          const run = getSourceRun(src);
          const isError = run?.status === "error";
          const isSample = src === "NDMA";

          return (
            <div key={src} className="flex items-center space-x-1.5">
              <span className="font-mono font-medium text-qc-text-tertiary">{src}:</span>
              {run ? (
                <div className="flex items-center space-x-1">
                  {isError ? (
                    <span className="text-red-400 flex items-center space-x-0.5 font-mono text-[11px]">
                      <AlertCircle className="h-3 w-3" />
                      <span>Err</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center space-x-0.5 font-mono text-[11px] tabular-nums">
                      <CheckCircle className="h-3 w-3" />
                      <span>{run.records_created + run.records_updated} rec</span>
                    </span>
                  )}
                  <span className="text-[10px] text-qc-text-tertiary font-mono">
                    ({formatTime(run.started_at)})
                  </span>
                </div>
              ) : (
                <span className="text-qc-text-disabled text-[11px] font-mono">Idle</span>
              )}

              {isSample && (
                <span className="text-[9px] px-1 py-0.5 bg-amber-950/60 border border-amber-800/80 text-amber-300 rounded font-mono">
                  Sample
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
