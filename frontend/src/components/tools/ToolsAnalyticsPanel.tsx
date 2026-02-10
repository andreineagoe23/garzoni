import React, { useMemo } from "react";
import { getToolAnalytics } from "services/toolsAnalytics";

const thresholds = {
  tool_completion_rate: 0.5,
  portfolio_return_rate: 0.2,
  next_steps_clickthrough: 0.15,
  news_tool_return: 0.15,
};

const ToolsAnalyticsPanel = () => {
  const analytics = useMemo(() => getToolAnalytics(), []);

  const toolOpen = analytics.counts?.tool_open?.total || 0;
  const toolComplete = analytics.counts?.tool_complete?.total || 0;
  const toolReturn = analytics.counts?.tool_return?.total || 0;
  const recommendationClick = analytics.counts?.recommendation_click?.total || 0;

  const completionRate = toolOpen > 0 ? toolComplete / toolOpen : 0;
  const returnRate = toolOpen > 0 ? toolReturn / toolOpen : 0;
  const nextStepsRate = toolOpen > 0 ? recommendationClick / toolOpen : 0;

  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]">
      <p className="text-xs font-semibold uppercase tracking-wide">
        Tools analytics (debug) — see docs/monitoring-red-flags.md
      </p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Completion rate (tool_open → tool_complete)
          </p>
          <p className="text-sm text-[color:var(--text-color,#111827)]">
            {(completionRate * 100).toFixed(1)}%{" "}
            <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
              (target {thresholds.tool_completion_rate * 100}%)
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Return rate
          </p>
          <p className="text-sm text-[color:var(--text-color,#111827)]">
            {(returnRate * 100).toFixed(1)}%{" "}
            <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
              (target {thresholds.portfolio_return_rate * 100}%)
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Next steps CTR
          </p>
          <p className="text-sm text-[color:var(--text-color,#111827)]">
            {(nextStepsRate * 100).toFixed(1)}%{" "}
            <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
              (target {thresholds.next_steps_clickthrough * 100}%)
            </span>
          </p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide">
          Raw JSON
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-white/60 p-3 text-xs text-[color:var(--text-color,#111827)]">
          {JSON.stringify(analytics, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default ToolsAnalyticsPanel;
