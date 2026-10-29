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
    default: "border-qc-border-subtle hover:border-qc-border-strong",
    accent: "border-sky-800/70 bg-gradient-to-br from-qc-surface-1 to-sky-950/20",
    critical: "border-red-800/70 bg-gradient-to-br from-qc-surface-1 to-red-950/20",
    warning: "border-amber-800/70 bg-gradient-to-br from-qc-surface-1 to-amber-950/20",
    success: "border-emerald-800/70 bg-gradient-to-br from-qc-surface-1 to-emerald-950/20",
  }[tone];

  const valueDisplay = value === null || value === undefined ? "—" : value;

  return (
    <div
      className={`bg-qc-surface-1 border rounded-lg p-4 transition-all duration-150 ${toneStyles} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-qc-text-secondary tracking-wide uppercase">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-qc-text-tertiary shrink-0" />}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-sans tracking-tight text-qc-text-primary tabular-nums">
          {valueDisplay}
        </span>
        {unit && (
          <span className="text-xs font-mono text-qc-text-tertiary">
            {unit}
          </span>
        )}
      </div>

      {(subtext || source || freshness) && (
        <div className="mt-2.5 pt-2 border-t border-qc-border-subtle/60 flex items-center justify-between text-[11px] text-qc-text-tertiary">
          <span>{subtext || (source ? `Src: ${source}` : "")}</span>
          {freshness && <span className="font-mono text-[10px]">{freshness}</span>}
        </div>
      )}
    </div>
  );
};
