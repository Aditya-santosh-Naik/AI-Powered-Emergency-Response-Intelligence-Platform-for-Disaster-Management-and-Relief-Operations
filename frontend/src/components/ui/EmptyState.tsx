import React from "react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description: string;
  illustration?: "reports" | "predictions" | "map";
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustration,
  icon: Icon,
  action,
  className = "",
}) => {
  const illustrationSrc = illustration
    ? {
        reports: "/src/assets/illustrations/empty-reports.svg",
        predictions: "/src/assets/illustrations/empty-predictions.svg",
        map: "/src/assets/illustrations/empty-map.svg",
      }[illustration]
    : undefined;

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl bg-qc-surface-1 border border-qc-border-subtle ${className}`}
    >
      {illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt=""
          aria-hidden="true"
          className="w-36 h-28 mb-4 opacity-80"
        />
      ) : Icon ? (
        <div className="w-12 h-12 rounded-full bg-qc-surface-2 border border-qc-border-subtle flex items-center justify-center mb-4 text-qc-text-tertiary">
          <Icon className="w-6 h-6" />
        </div>
      ) : null}

      <h3 className="text-sm font-semibold text-qc-text-primary tracking-wide mb-1">
        {title}
      </h3>
      <p className="text-xs text-qc-text-secondary max-w-sm mb-4 leading-relaxed">
        {description}
      </p>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
