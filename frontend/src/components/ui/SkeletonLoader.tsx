import React from "react";

/* ── Shared pulse bar ─────────────────────────────────────── */
const Bone: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/60 ${className}`}
  />
);

/* ── SkeletonCard ─────────────────────────────────────────── */
export interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  className = "",
}) => (
  <div
    className={`rounded-2xl border border-border-subtle bg-white/95 dark:bg-slate-900/85 p-4 space-y-3 shadow-sm ${className}`}
    aria-busy="true"
    aria-label="Loading content"
  >
    <Bone className="h-4 w-2/5" />
    {Array.from({ length: lines }).map((_, i) => (
      <Bone
        key={i}
        className={`h-3 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
      />
    ))}
  </div>
);

/* ── SkeletonKpi ──────────────────────────────────────────── */
export interface SkeletonKpiProps {
  className?: string;
}

export const SkeletonKpi: React.FC<SkeletonKpiProps> = ({
  className = "",
}) => (
  <div
    className={`rounded-2xl border border-border-subtle bg-white/95 dark:bg-slate-900/85 p-4 space-y-3 shadow-sm ${className}`}
    aria-busy="true"
    aria-label="Loading KPI"
  >
    <div className="flex items-center justify-between">
      <Bone className="h-3 w-20" />
      <Bone className="h-9 w-9 rounded-xl" />
    </div>
    <Bone className="h-7 w-24" />
    <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
      <Bone className="h-3 w-16" />
      <Bone className="h-4 w-14 rounded" />
    </div>
  </div>
);

/* ── SkeletonTable ────────────────────────────────────────── */
export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className = "",
}) => (
  <div
    className={`rounded-2xl border border-border-subtle bg-white/95 dark:bg-slate-900/85 overflow-hidden shadow-sm ${className}`}
    aria-busy="true"
    aria-label="Loading table"
  >
    {/* Header row */}
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle bg-slate-50 dark:bg-slate-800/50">
      {Array.from({ length: columns }).map((_, i) => (
        <Bone key={`h-${i}`} className="h-3 flex-1" />
      ))}
    </div>

    {/* Body rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 border-border-subtle"
      >
        {Array.from({ length: columns }).map((_, c) => (
          <Bone
            key={`${r}-${c}`}
            className={`h-3 flex-1 ${c === 0 ? "w-2/3" : ""}`}
          />
        ))}
      </div>
    ))}
  </div>
);
