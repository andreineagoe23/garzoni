## Tools Principles

These rules keep the tools system focused and prevent scope creep.

### Non-negotiable constraints

- No new tools outside the six defined in the tools registry.
- No “just add a widget” unless it adds context and insight.
- No AI chat unless it answers a concrete decision.

### Every tool must

- Produce an insight or recommendation.
- Connect to learning or a next action.

### Exception: public marketing calculators

The public, no-login calculators — compound interest, savings goal and 50/30/20 budget
(`/calculators/*` and their `/ro` twins, `frontend/src/components/calculators/`) — are SEO
landing pages, not in-app tools. They live outside the tools registry and do not count towards
it: the in-app tool list stays at six (approved 2026-10-08). Each still has to end in a next
action — a free lesson and the signup CTA.
