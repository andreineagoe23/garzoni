// Maps numeric courseId -> tool CTA shown on the completion screen.
// Populate keys by checking /admin/courses/course/ for real course IDs.
export const COURSE_TO_TOOL_CTA: Record<
  number,
  { toolUrl: string; ctaText: string }
> = {
  // Example entries (replace with real course IDs from DB):
  // 3: { toolUrl: "/tools/portfolio", ctaText: "Analyze your own portfolio's diversification →" },
  // 5: { toolUrl: "/tools/savings-goals", ctaText: "Calculate your compound interest growth →" },
  // 8: { toolUrl: "/tools/market-explorer", ctaText: "Look up how a stock is performing today →" },
};

export type ToolPracticeCta = {
  toolSlug: string;
  webToolUrl: string;
  mobileToolUrl: string;
  ctaText: string;
};

const TOOL_CTA_BY_SKILL_KEY: Record<string, ToolPracticeCta> = {
  budgeting: {
    toolSlug: "budget-planner",
    webToolUrl: "/tools/budget-planner",
    mobileToolUrl: "/(tabs)/tools/budget-planner",
    ctaText: "Put it to practice in the Budget Planner",
  },
  budget: {
    toolSlug: "budget-planner",
    webToolUrl: "/tools/budget-planner",
    mobileToolUrl: "/(tabs)/tools/budget-planner",
    ctaText: "Put it to practice in the Budget Planner",
  },
  saving: {
    toolSlug: "savings-goals",
    webToolUrl: "/tools/savings-calculator",
    mobileToolUrl: "/(tabs)/tools/savings-goals",
    ctaText: "Try this with a savings goal",
  },
  savings: {
    toolSlug: "savings-goals",
    webToolUrl: "/tools/savings-calculator",
    mobileToolUrl: "/(tabs)/tools/savings-goals",
    ctaText: "Try this with a savings goal",
  },
  investing: {
    toolSlug: "portfolio",
    webToolUrl: "/tools/portfolio",
    mobileToolUrl: "/(tabs)/tools/portfolio",
    ctaText: "Apply this in the Portfolio tool",
  },
  investment: {
    toolSlug: "portfolio",
    webToolUrl: "/tools/portfolio",
    mobileToolUrl: "/(tabs)/tools/portfolio",
    ctaText: "Apply this in the Portfolio tool",
  },
  market: {
    toolSlug: "market-explorer",
    webToolUrl: "/tools/market-explorer",
    mobileToolUrl: "/(tabs)/tools/market-explorer",
    ctaText: "Explore it in Market Explorer",
  },
  inflation: {
    toolSlug: "economic-map",
    webToolUrl: "/tools/economic-map",
    mobileToolUrl: "/(tabs)/tools/economic-map",
    ctaText: "See the real-world context",
  },
};

export function getToolPracticeCtaForSkill(
  skill?: string | null,
): ToolPracticeCta | null {
  const key = String(skill || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!key) return null;
  for (const [needle, cta] of Object.entries(TOOL_CTA_BY_SKILL_KEY)) {
    if (key.includes(needle)) return cta;
  }
  return null;
}
