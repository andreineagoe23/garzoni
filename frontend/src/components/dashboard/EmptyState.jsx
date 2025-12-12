import React from "react";
import { GlassButton } from "components/ui";

/**
 * Reusable empty state component for dashboard widgets
 */
export const EmptyState = ({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/40 p-8 text-center ${className}`}
    >
      <span className="text-4xl mb-4" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[color:var(--muted-text,#6b7280)] mb-4 max-w-sm">
        {description}
      </p>
      {actionLabel && onAction && (
        <GlassButton onClick={onAction} variant="primary">
          {actionLabel}
        </GlassButton>
      )}
    </div>
  );
};
