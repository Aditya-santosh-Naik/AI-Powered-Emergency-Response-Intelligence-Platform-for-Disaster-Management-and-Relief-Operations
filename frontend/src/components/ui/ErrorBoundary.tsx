import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-red-500/10 border border-red-500/30 shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-red-600 dark:text-red-400 tracking-wide mb-1">
            Something went wrong
          </h3>

          <p className="text-xs text-text-secondary max-w-md mb-4 leading-relaxed font-mono break-all">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>

          <Button
            variant="secondary"
            size="sm"
            icon={AlertTriangle}
            onClick={this.handleReset}
            aria-label="Try again"
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
