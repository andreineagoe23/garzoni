# Monitoring: success, not vanity

You already track events. These are **red flags** to investigate, not real-time alerts.

## Minimum alert thresholds (examples)

| Area | Metric | Red flag | Action |
|------|--------|----------|--------|
| **Portfolio Analyzer** | `tool_open` → `tool_complete` | &lt; 50% completion rate | Investigate: UX friction, errors, or drop-off |
| **Next Steps** | `recommendation_click` vs impressions | &lt; 10% click-through | Bad recommendations or unclear actions |
| **News** | `tool_return` (users coming back to news) | &lt; 15% | Content not sticky or not relevant |

## How to use this

- **Log these weekly**, not real-time (e.g. from tools analytics or your funnel/analytics store).
- Compute ratios from stored events: e.g. `tool_complete / tool_open` per tool; `recommendation_click / recommendation_shown` for Next Steps.
- When a threshold is below the bar, **investigate** (Sentry, logs, user feedback) before adding features.

## Definition of done

You can answer:

> **"Which tool is failing users this week?"**

without guessing.

---

## Where the numbers come from

- **Frontend**: `getToolAnalytics()` (see `ToolsAnalyticsPanel`) and/or your analytics backend (e.g. funnel events).
- **Backend**: Funnel/tool events ingested via `FunnelEventIngestView` and aggregated for weekly review.

Use the same event names (`tool_open`, `tool_complete`, `tool_return`, `recommendation_click`) so frontend and backend metrics align.
