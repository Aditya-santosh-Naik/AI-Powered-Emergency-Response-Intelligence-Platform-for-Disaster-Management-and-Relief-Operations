import React from "react";
import { Database, Globe, UserCheck, Sparkles, HelpCircle } from "lucide-react";

export type ProvenanceType =
  | "measured"
  | "external"
  | "user-entered"
  | "estimated"
  | "synthetic"
  | "unavailable";

export interface ProvenanceLabelProps {
  type: ProvenanceType;
  timestamp?: string;
  sourceName?: string;
  className?: string;
}

export const ProvenanceLabel: React.FC<ProvenanceLabelProps> = ({
  type,
  timestamp,
  sourceName,
  className = "",
}) => {
  const config = {
    measured: {
      label: "Measured",
      icon: Database,
      styles: "bg-qc-surface-2 text-qc-text-secondary border-qc-border-subtle",
    },
    external: {
      label: sourceName ? `External (${sourceName})` : "External Feed",
      icon: Globe,
      styles: "bg-qc-surface-2 text-sky-300 border-sky-800/60",
    },
    "user-entered": {
      label: "User-Entered",
      icon: UserCheck,
      styles: "bg-qc-surface-2 text-amber-300 border-amber-800/60",
    },
    estimated: {
      label: "Model Estimated",
      icon: Sparkles,
      styles: "bg-qc-surface-2 text-qc-text-primary border-qc-border-strong",
    },
    synthetic: {
      label: "Synthetic Baseline",
      icon: Sparkles,
      styles: "bg-purple-950/40 text-purple-300 border-purple-500/50",
    },
    unavailable: {
      label: "Unavailable",
      icon: HelpCircle,
      styles: "bg-qc-surface-2 text-qc-text-disabled border-qc-border-subtle",
    },
  }[type];

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${config.styles} ${className}`}
      title={timestamp ? `Data recorded: ${timestamp}` : undefined}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{config.label}</span>
      {timestamp && (
        <span className="text-[10px] text-qc-text-tertiary border-l border-qc-border-subtle pl-1">
          {timestamp}
        </span>
      )}
    </span>
  );
};
