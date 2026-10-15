import React from "react";

interface Props {
  level?: string;
  score?: number;
}

export const SeverityBadge: React.FC<Props> = ({ level, score }) => {
  const normalized = (level || "Low").toLowerCase();

  let colorClasses = "bg-emerald-950/80 text-emerald-400 border-emerald-800";
  if (normalized === "critical" || normalized === "red") {
    colorClasses = "bg-red-950/80 text-red-400 border-red-800";
  } else if (normalized === "high" || normalized === "orange") {
    colorClasses = "bg-orange-950/80 text-orange-400 border-orange-800";
  } else if (normalized === "moderate" || normalized === "yellow") {
    colorClasses = "bg-amber-950/80 text-amber-400 border-amber-800";
  }

  return (
    <span
      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}
    >
      <span className="capitalize">{level || "Low"}</span>
      {score !== undefined && (
        <span className="opacity-80 font-mono text-[10px]">({score})</span>
      )}
    </span>
  );
};
