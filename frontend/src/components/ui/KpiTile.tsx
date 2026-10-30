import React from "react";

export interface KpiTileProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  source?: string;
  freshness?: string;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "accent" | "critical" | "warning" | "success";
  className?: string;
}

export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  unit,
  source,
  freshness,
  subtext,
  icon: Icon,
  tone = "default",
  className = "",
}) => {
  const toneStyles = {
    default: "border-border-subtle hover:border-border-strong",
    accent: "border-sky-500/30 bg-sky-500/10 shadow-sm",
    critical: "border-red-500/30 bg-red-500/10 shadow-sm",
    warning: "border-amber-500/30 bg-amber-500/10 shadow-sm",
    success: "border-emerald-500/30 bg-emerald-500/10 shadow-sm",
  }[tone];

  const valueDisplay = value === null || value === undefined ? "—" : value;

  return (
    <div
      className={`glass-panel border rounded-2xl p-4 transition-all duration-200 ${toneStyles} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-text-secondary tracking-wide uppercase">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-text-tertiary shrink-0" />}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-sans tracking-tight text-text-primary tabular-nums">
          {valueDisplay}
        </span>
        {unit && (
          <span className="text-xs font-mono text-text-tertiary">
            {unit}
          </span>
        )}
      </div>

      {(subtext || source || freshness) && (
        <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-tertiary">
          <span>{subtext || (source ? `Src: ${source}` : "")}</span>
          {freshness && <span className="font-mono text-[10px]">{freshness}</span>}
        </div>
      )}
    </div>
  );
};
