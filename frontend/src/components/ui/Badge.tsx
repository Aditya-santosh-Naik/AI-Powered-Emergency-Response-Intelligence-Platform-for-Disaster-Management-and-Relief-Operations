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
    default: "glass-card text-text-secondary border border-border-subtle",
    "severity-critical": "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-semibold",
    "severity-high": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 font-semibold",
    "severity-moderate": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold",
    "severity-low": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold",
    "severity-unknown": "glass-card text-text-tertiary border border-border-subtle",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium",
    info: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-medium",
    outline: "bg-transparent text-text-secondary border border-border-strong",
    synthetic: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-mono",
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-sans tracking-wide select-none ${sizeStyles} ${variantStyles} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
