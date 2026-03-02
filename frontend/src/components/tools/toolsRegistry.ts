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
};

export const TOOL_STORAGE_KEYS = {
  lastTool: "monevo:tools:last-tool",
  sessionId: "monevo:tools:session-id",
  navSource: "monevo:tools:last-source",
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
    activityStorageKey: "monevo:tools:activity:portfolio",
  },
  {
    id: "reality-check",
    group: "understand-myself",
    route: "reality-check",
    component: GoalsRealityCheck,
    learnPath: "/all-topics?topic=saving",
    cardImage: "tools/savings_goals.png",
    keywords: ["savings", "goals", "budget", "reality check"],
    activityStorageKey: "monevo:tools:activity:reality-check",
  },
  {
    id: "calendar",
    group: "understand-world",
    route: "calendar",
    component: EconomicCalendar,
    learnPath: "/all-topics?topic=macro",
    cardImage: "tools/economic_calendar.png",
    keywords: ["calendar", "macro", "events", "inflation", "rates"],
    activityStorageKey: "monevo:tools:activity:calendar",
  },
  {
    id: "economic-map",
    group: "understand-world",
    route: "economic-map",
    component: EconomicMap,
    learnPath: "/all-topics?topic=macro",
    cardImage: "tools/economic_map.png",
    keywords: ["macro", "economy", "map", "global"],
    activityStorageKey: "monevo:tools:activity:economic-map",
  },
  {
    id: "news-context",
    group: "understand-world",
    route: "news-context",
    component: NewsMarketContext,
    learnPath: "/all-topics?topic=markets",
    cardImage: "tools/news_market.png",
    keywords: ["news", "markets", "macro", "context"],
    activityStorageKey: "monevo:tools:activity:news-context",
  },
  {
    id: "market-explorer",
    group: "decide-next",
    route: "market-explorer",
    component: MarketExplorer,
    learnPath: "/all-topics?topic=investing",
    cardImage: "tools/market_explorer.png",
    keywords: ["markets", "stocks", "etf", "crypto", "indices"],
    activityStorageKey: "monevo:tools:activity:market-explorer",
  },
  {
    id: "next-steps",
    group: "decide-next",
    route: "next-steps",
    component: NextStepsEngine,
    learnPath: "/all-topics?topic=planning",
    keywords: ["recommendations", "next steps", "plan"],
    activityStorageKey: "monevo:tools:activity:next-steps",
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
