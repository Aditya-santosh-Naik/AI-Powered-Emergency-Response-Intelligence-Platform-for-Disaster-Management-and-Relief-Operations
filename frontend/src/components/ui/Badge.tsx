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
  const sizeStyles = size === "sm" ? "text-[11px] px-2.5 py-0.5 gap-1 rounded-full" : "text-xs px-3 py-1 gap-1.5 rounded-full";

  const variantStyles = {
    default: "bg-slate-100 text-text-primary border border-border-subtle font-medium dark:bg-slate-800",
    "severity-critical": "bg-red-50 text-red-700 border border-red-200 font-bold dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
    "severity-high": "bg-orange-50 text-orange-700 border border-orange-200 font-bold dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30",
    "severity-moderate": "bg-amber-50 text-amber-800 border border-amber-200 font-bold dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
    "severity-low": "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
    "severity-unknown": "bg-slate-100 text-text-tertiary border border-border-subtle dark:bg-slate-800",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
    info: "bg-blue-50 text-blue-700 border border-blue-200 font-semibold dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30",
    outline: "bg-transparent text-text-secondary border border-border-strong font-medium",
    synthetic: "bg-purple-50 text-purple-700 border border-purple-200 font-mono font-semibold dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30",
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-sans tracking-wide select-none shadow-sm ${sizeStyles} ${variantStyles} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
