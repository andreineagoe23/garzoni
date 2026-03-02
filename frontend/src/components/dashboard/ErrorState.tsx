import React from "react";
import { useTranslation } from "react-i18next";
import { GlassButton } from "components/ui";

/**
 * Error state component with retry functionality
 */
type ErrorStateProps = {
  title?: React.ReactNode;
  message?: React.ReactNode;
  onRetry?: () => void;
  isRetrying?: boolean;
  cachedData?: unknown;
  className?: string;
};

export const ErrorState = ({
  title,
  message,
  onRetry,
  isRetrying = false,
  cachedData = null,
  className = "",
}: ErrorStateProps) => {
  const { t } = useTranslation();
  const displayTitle = title ?? t("dashboard.errorState.title");
  const displayMessage = message ?? t("dashboard.errorState.message");
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
            {displayTitle}
          </h3>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)] mb-3">
            {displayMessage}
          </p>
          {Boolean(cachedData) && (
            <p className="text-xs text-[color:var(--muted-text,#6b7280)] mb-3 italic">
              {t("dashboard.errorState.showingCached")}
            </p>
          )}
          {onRetry && (
            <GlassButton
              onClick={onRetry}
              disabled={isRetrying}
              variant="primary"
              size="sm"
            >
              {isRetrying
                ? t("dashboard.errorState.retrying")
                : t("dashboard.errorState.retry")}
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
};
