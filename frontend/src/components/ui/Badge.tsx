import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "severity-critical" | "severity-high" | "severity-moderate" | "severity-low" | "severity-unknown" | "success" | "info" | "outline" | "synthetic";
  size?: "sm" | "md";
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "sm",
  icon: Icon,
  className = "",
}) => {
  const sizeStyles = size === "sm" ? "text-[11px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";

  const variantStyles = {
    default: "bg-qc-surface-2 text-qc-text-secondary border border-qc-border-subtle",
    "severity-critical": "bg-red-950/80 text-red-300 border border-red-700/80 font-medium",
    "severity-high": "bg-amber-950/80 text-orange-300 border border-orange-700/80 font-medium",
    "severity-moderate": "bg-yellow-950/80 text-amber-300 border border-yellow-700/80 font-medium",
    "severity-low": "bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 font-medium",
    "severity-unknown": "bg-slate-900 text-qc-text-tertiary border border-qc-border-subtle",
    success: "bg-emerald-950/70 text-emerald-300 border border-emerald-700/70",
    info: "bg-sky-950/70 text-sky-300 border border-sky-700/70",
    outline: "bg-transparent text-qc-text-secondary border border-qc-border-strong",
    synthetic: "bg-purple-950/60 text-purple-300 border border-purple-600/60 font-mono",
  }[variant];

  return (
    <span
      className={`inline-flex items-center rounded font-sans tracking-wide select-none ${sizeStyles} ${variantStyles} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
