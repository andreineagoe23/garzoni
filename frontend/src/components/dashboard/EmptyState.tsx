import React from "react";
import { GlassButton } from "components/ui";

/**
 * Reusable empty state component for dashboard widgets
 */
type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  actionLabel?: React.ReactNode;
  onAction?: () => void;
  className?: string;
};

export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/40 p-8 text-center ${className}`}
    >
      {icon && <span className="text-4xl mb-4">{icon}</span>}
      <h3 className="text-lg font-semibold text-content-primary mb-2">
        {title}
      </h3>
      <p className="text-sm text-content-muted mb-4 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <GlassButton onClick={onAction} variant="primary">
          {actionLabel}
        </GlassButton>
      )}
    </div>
  );
};
