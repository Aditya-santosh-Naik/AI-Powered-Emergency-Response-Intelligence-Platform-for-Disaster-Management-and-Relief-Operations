import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export interface CopyableIdProps {
  id: string;
  prefix?: string;
  className?: string;
}

export const CopyableId: React.FC<CopyableIdProps> = ({ id, prefix, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy ID"
      className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-0.5 rounded bg-qc-surface-2 border border-qc-border-subtle hover:border-qc-border-strong text-qc-text-primary hover:text-qc-accent transition-colors ${className}`}
    >
      {prefix && <span className="text-qc-text-tertiary">{prefix}</span>}
      <span className="font-semibold">{id}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-qc-text-tertiary shrink-0" />
      )}
    </button>
  );
};
