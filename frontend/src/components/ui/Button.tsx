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
    "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none rounded-md select-none disabled:opacity-50 disabled:pointer-events-none";

  const sizeStyles = {
    sm: "h-8 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3.5 text-sm gap-2",
    lg: "h-11 px-5 text-base gap-2.5",
  }[size];

  const variantStyles = {
    primary:
      "bg-qc-accent text-qc-accent-contrast hover:bg-qc-accent-hover font-semibold shadow-sm active:scale-[0.99]",
    secondary:
      "bg-qc-surface-2 text-qc-text-primary hover:bg-qc-surface-3 border border-qc-border-subtle hover:border-qc-border-strong",
    ghost:
      "bg-transparent text-qc-text-secondary hover:text-qc-text-primary hover:bg-qc-surface-2",
    danger:
      "bg-red-950/60 text-red-300 border border-red-800/80 hover:bg-red-900/80 hover:text-red-200",
    accent:
      "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/80 hover:text-emerald-200",
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
