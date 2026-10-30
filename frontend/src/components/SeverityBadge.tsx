import React from "react";

interface Props {
  level?: string;
  score?: number;
  className?: string;
}

export const SeverityBadge: React.FC<Props> = ({ level, score, className = "" }) => {
  const normalized = (level || "Low").toLowerCase();

  let colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
  let symbol = "●";

  if (normalized === "critical" || normalized === "red") {
    colorClasses = "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30";
    symbol = "▲";
  } else if (normalized === "high" || normalized === "orange") {
    colorClasses = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30";
    symbol = "◆";
  } else if (normalized === "moderate" || normalized === "yellow") {
    colorClasses = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";
    symbol = "■";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border font-sans select-none shadow-sm ${colorClasses} ${className}`}
    >
      <span className="text-[10px] opacity-90 leading-none" aria-hidden="true">
        {symbol}
      </span>
      <span className="capitalize">{level || "Low"}</span>
      {score !== undefined && (
        <span className="opacity-80 font-mono text-[10px]">({score})</span>
      )}
    </span>
  );
};
