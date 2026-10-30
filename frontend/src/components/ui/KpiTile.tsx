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
    default: "border-border-subtle hover:border-border-strong bg-white/95 dark:bg-slate-900/85",
    accent: "border-blue-200 dark:border-sky-500/30 bg-blue-50/60 dark:bg-sky-500/10 shadow-sm",
    critical: "border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10 shadow-sm",
    warning: "border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 shadow-sm",
    success: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 shadow-sm",
  }[tone];

  const valueDisplay = value === null || value === undefined ? "—" : value;

  return (
    <div
      className={`border rounded-2xl p-4 transition-all duration-200 shadow-sm ${toneStyles} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-text-tertiary tracking-wide uppercase">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-text-tertiary shrink-0" />}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-text-primary tabular-nums">
          {valueDisplay}
        </span>
        {unit && (
          <span className="text-xs font-mono font-medium text-text-tertiary">
            {unit}
          </span>
        )}
      </div>

      {(subtext || source || freshness) && (
        <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-tertiary font-medium">
          <span>{subtext || (source ? `Src: ${source}` : "")}</span>
          {freshness && <span className="font-mono text-[10px]">{freshness}</span>}
        </div>
      )}
    </div>
  );
};
