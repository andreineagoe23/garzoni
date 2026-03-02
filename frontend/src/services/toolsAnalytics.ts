export type ToolAnalyticsEvent = {
  type: string;
  toolId?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = "monevo:tools:analytics";

type AnalyticsState = {
  counts: Record<string, { total: number; byTool: Record<string, number> }>;
  events: ToolAnalyticsEvent[];
};

const getEmptyState = (): AnalyticsState => ({
  counts: {},
  events: [],
});

export const recordToolEvent = (
  type: string,
  toolId?: string,
  meta?: Record<string, unknown>
) => {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const state: AnalyticsState = stored ? JSON.parse(stored) : getEmptyState();
    const event: ToolAnalyticsEvent = {
      type,
      toolId,
      meta,
      timestamp: new Date().toISOString(),
    };
    state.events = [event, ...state.events].slice(0, 200);
    if (!state.counts[type]) {
      state.counts[type] = { total: 0, byTool: {} };
    }
    state.counts[type].total += 1;
    if (toolId) {
      state.counts[type].byTool[toolId] =
        (state.counts[type].byTool[toolId] || 0) + 1;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_err) {
    // Best-effort logging only.
  }
};

export const getToolAnalytics = (): AnalyticsState => {
  if (typeof window === "undefined") return getEmptyState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : getEmptyState();
  } catch (_err) {
    return getEmptyState();
  }
};
