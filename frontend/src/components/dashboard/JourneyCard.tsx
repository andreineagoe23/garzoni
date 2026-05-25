import React from "react";
import type { WhatsNextAction } from "@garzoni/core";
import { GarzoniIcon } from "components/ui/garzoniIcons";

type JourneyCardProps = {
  action?: WhatsNextAction | null;
  isLoading?: boolean;
  onAction: (action: WhatsNextAction) => void;
  canAdminister?: boolean;
  adminMode?: boolean;
  toggleAdminMode?: () => void;
};

const ICON_BY_TYPE: Record<string, string> = {
  review: "fire",
  practice: "dumbbell",
  lesson: "bookOpen",
  quiz: "target",
  tutor: "robot",
  tool_followup: "tools",
  resume: "rocket",
  start: "bookOpen",
  explore: "lightbulb",
};

export default function JourneyCard({
  action,
  isLoading,
  onAction,
  canAdminister,
  adminMode,
  toggleAdminMode,
}: JourneyCardProps) {
  const iconName = ICON_BY_TYPE[action?.type || "explore"] || "rocket";

  return (
    <div className="app-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="app-icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-[color:var(--color-brand-primary,var(--primary,#1d5330))]/25">
            <GarzoniIcon name={iconName} size={22} />
          </div>
          <div className="min-w-0">
            <p className="app-eyebrow mb-1">Continue your journey</p>
            <h2 className="app-display text-2xl text-content-primary sm:text-3xl">
              {isLoading
                ? "Finding your next step..."
                : action?.title || "Choose your next topic"}
            </h2>
            <p className="mt-1 text-sm text-content-muted sm:text-base">
              {isLoading
                ? "Garzoni is checking your lessons, reviews, and practice."
                : action?.subtitle ||
                  "Browse the course library and start learning."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {action ? (
            <button
              type="button"
              onClick={() => onAction(action)}
              className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              Continue
            </button>
          ) : null}
          {canAdminister && (
            <button
              type="button"
              onClick={() => toggleAdminMode?.()}
              aria-pressed={adminMode}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 ${
                adminMode
                  ? "border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)] text-white"
                  : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-content-muted hover:border-[color:var(--primary,#1d5330)]/60"
              } focus:ring-[color:var(--primary,#1d5330)]/40`}
            >
              {adminMode ? "Admin mode" : "Enable admin"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
