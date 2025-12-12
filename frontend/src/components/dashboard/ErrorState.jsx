import React from "react";
import { GlassButton } from "components/ui";

/**
 * Error state component with retry functionality
 */
export const ErrorState = ({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  onRetry,
  isRetrying = false,
  cachedData = null,
  className = "",
}) => {
  return (
    <div
      className={`rounded-xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[color:var(--error,#dc2626)] mb-1">
            {title}
          </h3>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)] mb-3">
            {message}
          </p>
          {cachedData && (
            <p className="text-xs text-[color:var(--muted-text,#6b7280)] mb-3 italic">
              Showing cached data from your last visit.
            </p>
          )}
          {onRetry && (
            <GlassButton
              onClick={onRetry}
              disabled={isRetrying}
              variant="primary"
              size="sm"
            >
              {isRetrying ? "Retrying..." : "Retry"}
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
};
