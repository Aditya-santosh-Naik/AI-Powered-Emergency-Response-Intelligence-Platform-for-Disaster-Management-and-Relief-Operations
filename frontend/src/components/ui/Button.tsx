import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  disabled,
  className = "",
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none rounded-xl select-none disabled:opacity-50 disabled:pointer-events-none";

  const sizeStyles = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-9 px-4 text-xs font-semibold gap-2",
    lg: "h-11 px-5 text-sm font-semibold gap-2.5",
  }[size];

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md shadow-sky-500/20 active:scale-[0.99]",
    secondary:
      "glass-card text-text-primary hover:bg-surface-3 border border-border-subtle hover:border-border-strong shadow-sm",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3",
    danger:
      "bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/30 hover:bg-red-500/25",
    accent:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25",
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0 text-current" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};
