import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Service Communication Error",
  message,
  onRetry,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`rounded-lg bg-red-950/40 border border-red-800/80 p-5 text-left flex flex-col sm:flex-row items-start gap-4 ${className}`}
    >
      <div className="w-9 h-9 rounded-md bg-red-900/60 border border-red-700 flex items-center justify-center text-red-300 shrink-0">
        <AlertCircle className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-red-200 tracking-wide mb-1">
          {title}
        </h4>
        <p className="text-xs text-red-300/90 leading-relaxed font-mono">
          {message}
        </p>

        {onRetry && (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={onRetry}
            >
              Retry Request
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
