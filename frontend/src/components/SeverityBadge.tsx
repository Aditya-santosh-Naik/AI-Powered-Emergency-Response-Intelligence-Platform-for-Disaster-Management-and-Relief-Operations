import React from "react";

interface Props {
  level?: string;
  score?: number;
  className?: string;
}

export const SeverityBadge: React.FC<Props> = ({ level, score, className = "" }) => {
  const normalized = (level || "Low").toLowerCase();

  let colorClasses = "bg-emerald-950/80 text-emerald-300 border-emerald-700/80";
  let symbol = "●";

  if (normalized === "critical" || normalized === "red") {
    colorClasses = "bg-red-950/80 text-red-300 border-red-700/80";
    symbol = "▲";
  } else if (normalized === "high" || normalized === "orange") {
    colorClasses = "bg-orange-950/80 text-orange-300 border-orange-700/80";
    symbol = "◆";
  } else if (normalized === "moderate" || normalized === "yellow") {
    colorClasses = "bg-amber-950/80 text-amber-300 border-amber-700/80";
    symbol = "■";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border font-sans select-none ${colorClasses} ${className}`}
    >
      <span className="text-[10px] opacity-90 leading-none" aria-hidden="true">
        {symbol}
      </span>
      <span className="capitalize">{level || "Low"}</span>
      {score !== undefined && (
        <span className="opacity-75 font-mono text-[10px]">({score})</span>
      )}
    </span>
  );
};
