import React from "react";

interface Props {
  level?: string;
  score?: number;
  className?: string;
}

export const SeverityBadge: React.FC<Props> = ({ level, score, className = "" }) => {
  const normalized = (level || "Low").toLowerCase();

  let colorClasses = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";
  let symbol = "●";

  if (normalized === "critical" || normalized === "red") {
    colorClasses = "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30";
    symbol = "▲";
  } else if (normalized === "high" || normalized === "orange") {
    colorClasses = "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30";
    symbol = "◆";
  } else if (normalized === "moderate" || normalized === "yellow") {
    colorClasses = "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30";
    symbol = "■";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border font-sans select-none ${colorClasses} ${className}`}
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
