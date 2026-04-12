import React from "react";

const PortfolioAnalyzer = React.lazy(() => import("./PortfolioAnalyzer"));
const EconomicCalendar = React.lazy(() => import("./EconomicCalendar"));
const EconomicMap = React.lazy(() => import("./EconomicMap"));
const NewsMarketContext = React.lazy(() => import("./NewsMarketContext"));
const GoalsRealityCheck = React.lazy(() => import("./GoalsRealityCheck"));
const MarketExplorer = React.lazy(() => import("./MarketExplorer"));
const NextStepsEngine = React.lazy(() => import("./NextStepsEngine"));

export type ToolGroupId =
  | "understand-world"
  | "understand-myself"
  | "decide-next";

export type ToolDefinition = {
  id: string;
  group: ToolGroupId;
  route: string;
  component: React.LazyExoticComponent<React.ComponentType>;
  learnPath: string;
  exportable?: boolean;
  keywords?: string[];
  activityStorageKey?: string;
  /** Optional image URL for the tools landing card. Falls back to group image. */
  cardImage?: string;
  /** Optional plan requirement (e.g. plus_or_pro for paid-only tools). */
  requiredPlan?: "plus_or_pro";
  /** Rough time to complete a typical pass (minutes), for hub badges. */
  estimatedMinutes?: number;
};

export const TOOL_STORAGE_KEYS = {
  lastTool: "garzoni:tools:last-tool",
  sessionId: "garzoni:tools:session-id",
  navSource: "garzoni:tools:last-source",
};

export const toolsRegistry: ToolDefinition[] = [
  {
    id: "portfolio",
    group: "understand-myself",
    route: "portfolio",
    component: PortfolioAnalyzer,
    learnPath: "/all-topics?topic=investing",
    exportable: true,
    cardImage: "tools/portfolio_analyzer.png",
    keywords: ["stocks", "allocation", "diversification", "returns"],
    activityStorageKey: "garzoni:tools:activity:portfolio",
    estimatedMinutes: 12,
  },
  {
    id: "reality-check",
    group: "understand-myself",
    route: "reality-check",
    component: GoalsRealityCheck,
    learnPath: "/all-topics?topic=saving",
    cardImage: "tools/savings_goals.png",
    keywords: ["savings", "goals", "budget", "reality check"],
    activityStorageKey: "garzoni:tools:activity:reality-check",
    estimatedMinutes: 8,
  },
  {
    id: "calendar",
    group: "understand-world",
    route: "calendar",
    component: EconomicCalendar,
    learnPath: "/all-topics?topic=macro",
    cardImage: "tools/economic_calendar.png",
    keywords: ["calendar", "macro", "events", "inflation", "rates"],
    activityStorageKey: "garzoni:tools:activity:calendar",
    estimatedMinutes: 6,
  },
  {
    id: "economic-map",
    group: "understand-world",
    route: "economic-map",
    component: EconomicMap,
    requiredPlan: "plus_or_pro",
    learnPath: "/all-topics?topic=macro",
    cardImage: "tools/economic_map.png",
    keywords: ["macro", "economy", "map", "global"],
    activityStorageKey: "garzoni:tools:activity:economic-map",
    estimatedMinutes: 15,
  },
  {
    id: "news-context",
    group: "understand-world",
    route: "news-context",
    component: NewsMarketContext,
    requiredPlan: "plus_or_pro",
    learnPath: "/all-topics?topic=markets",
    cardImage: "tools/news_market.png",
    keywords: ["news", "markets", "macro", "context"],
    activityStorageKey: "garzoni:tools:activity:news-context",
    estimatedMinutes: 10,
  },
  {
    id: "market-explorer",
    group: "decide-next",
    route: "market-explorer",
    component: MarketExplorer,
    requiredPlan: "plus_or_pro",
    learnPath: "/all-topics?topic=investing",
    cardImage: "tools/market_explorer.png",
    keywords: ["markets", "stocks", "etf", "crypto", "indices"],
    activityStorageKey: "garzoni:tools:activity:market-explorer",
    estimatedMinutes: 10,
  },
  {
    id: "next-steps",
    group: "decide-next",
    route: "next-steps",
    component: NextStepsEngine,
    learnPath: "/all-topics?topic=planning",
    keywords: ["recommendations", "next steps", "plan"],
    activityStorageKey: "garzoni:tools:activity:next-steps",
    estimatedMinutes: 5,
  },
];

export const toolGroups = [
  {
    id: "understand-world" as const,
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=180&fit=crop",
  },
  {
    id: "understand-myself" as const,
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=180&fit=crop",
  },
  {
    id: "decide-next" as const,
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=180&fit=crop",
  },
].map((group) => ({
  ...group,
  tools: toolsRegistry.filter((tool) => tool.group === group.id),
}));

export const toolByRoute = new Map(
  toolsRegistry.map((tool) => [tool.route, tool])
);
