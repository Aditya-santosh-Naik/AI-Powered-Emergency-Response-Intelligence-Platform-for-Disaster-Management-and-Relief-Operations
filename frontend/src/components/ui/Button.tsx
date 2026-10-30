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
    md: "h-9 px-4 text-xs font-bold gap-2",
    lg: "h-11 px-5 text-sm font-bold gap-2.5",
  }[size];

  const variantStyles = {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 active:scale-[0.99] dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600",
    secondary:
      "bg-white dark:bg-slate-800 text-text-primary hover:bg-slate-50 dark:hover:bg-slate-700 border border-border-subtle hover:border-border-strong shadow-sm font-semibold",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 font-medium",
    danger:
      "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 font-semibold",
    accent:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 font-semibold",
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
