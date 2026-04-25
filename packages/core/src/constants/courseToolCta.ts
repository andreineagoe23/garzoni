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
