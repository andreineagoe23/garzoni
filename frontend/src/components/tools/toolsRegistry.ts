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
  title: string;
  description: string;
  promise: string;
  mostUsefulFor?: string;
  group: ToolGroupId;
  route: string;
  component: React.LazyExoticComponent<React.ComponentType>;
  whatItDoes: string;
  sampleUseCase: string;
  whoItsFor: string;
  questionItAnswers: string;
  learnPath: string;
  exportable?: boolean;
  keywords?: string[];
  activityStorageKey?: string;
};

export const TOOL_STORAGE_KEYS = {
  lastTool: "monevo:tools:last-tool",
  sessionId: "monevo:tools:session-id",
  navSource: "monevo:tools:last-source",
};

export const toolsRegistry: ToolDefinition[] = [
  {
    id: "portfolio",
    title: "Portfolio Analyzer",
    description: "Analyze and optimize your investment portfolio",
    promise: "See if your portfolio matches your goals and risk comfort.",
    mostUsefulFor: "Anyone already investing or thinking about reallocating.",
    group: "understand-myself",
    route: "portfolio",
    component: PortfolioAnalyzer,
    whatItDoes: "Breaks down holdings, performance, and allocation in one view.",
    sampleUseCase: "Check if your portfolio is too concentrated in one asset.",
    whoItsFor: "Investors who want clarity on risk, concentration, and balance.",
    questionItAnswers: "Is my portfolio aligned with my goals and risk comfort?",
    learnPath: "/all-topics?topic=investing",
    exportable: true,
    keywords: ["stocks", "allocation", "diversification", "returns"],
    activityStorageKey: "monevo:tools:activity:portfolio",
  },
  {
    id: "reality-check",
    title: "Savings & Goals Reality Check",
    description: "See if your goals are realistic for your income and costs",
    promise: "Get a realistic saving range without false precision.",
    mostUsefulFor: "People with a goal and uncertain monthly cash flow.",
    group: "understand-myself",
    route: "reality-check",
    component: GoalsRealityCheck,
    whatItDoes: "Turns a goal into a realistic saving range and feasibility check.",
    sampleUseCase: "Plan a $6k emergency fund in 12 months without guesswork.",
    whoItsFor: "Anyone who wants an honest view of what’s achievable.",
    questionItAnswers: "Can I actually hit this goal with my current cash flow?",
    learnPath: "/all-topics?topic=saving",
    keywords: ["savings", "goals", "budget", "reality check"],
    activityStorageKey: "monevo:tools:activity:reality-check",
  },
  {
    id: "calendar",
    title: "Economic Calendar",
    description: "Track macro events with context, not just dates",
    promise: "Understand how big economic events affect your money.",
    mostUsefulFor: "Anyone trying to make sense of inflation and rates.",
    group: "understand-world",
    route: "calendar",
    component: EconomicCalendar,
    whatItDoes: "Shows key economic events and explains why they matter.",
    sampleUseCase: "See how CPI or rate decisions could affect savings rates.",
    whoItsFor: "Anyone trying to understand the bigger picture.",
    questionItAnswers: "What’s happening in the economy and why should I care?",
    learnPath: "/all-topics?topic=macro",
    keywords: ["calendar", "macro", "events", "inflation", "rates"],
    activityStorageKey: "monevo:tools:activity:calendar",
  },
  {
    id: "economic-map",
    title: "Economic Map",
    description: "Live global economic data visualized on a map",
    promise: "See macro changes around the world in one glance.",
    mostUsefulFor: "Anyone tracking global macro trends.",
    group: "understand-world",
    route: "economic-map",
    component: EconomicMap,
    whatItDoes: "Displays economic indicators on a world map.",
    sampleUseCase: "Check regional trends before reading the news.",
    whoItsFor: "People who want a global macro view.",
    questionItAnswers: "Where are economic shifts happening right now?",
    learnPath: "/all-topics?topic=macro",
    keywords: ["macro", "economy", "map", "global"],
    activityStorageKey: "monevo:tools:activity:economic-map",
  },
  {
    id: "news-context",
    title: "News & Market Context",
    description: "Curated finance news with plain-English meaning",
    promise: "Turn headlines into simple, personal takeaways.",
    mostUsefulFor: "People who want news without panic or hype.",
    group: "understand-world",
    route: "news-context",
    component: NewsMarketContext,
    whatItDoes: "Summarizes what headlines mean for everyday money decisions.",
    sampleUseCase: "See how a rate cut impacts loans or savings.",
    whoItsFor: "People who want news without the noise.",
    questionItAnswers: "What does this headline mean for me?",
    learnPath: "/all-topics?topic=markets",
    keywords: ["news", "markets", "macro", "context"],
    activityStorageKey: "monevo:tools:activity:news-context",
  },
  {
    id: "market-explorer",
    title: "Market Explorer",
    description: "Explore stocks, ETFs, crypto, and indices in one view",
    promise: "Scan major markets with simple, long-term framing.",
    mostUsefulFor: "Curious learners exploring markets for the first time.",
    group: "decide-next",
    route: "market-explorer",
    component: MarketExplorer,
    whatItDoes: "Lets you explore markets while surfacing volatility warnings.",
    sampleUseCase: "Compare S&P 500 vs bonds before making a decision.",
    whoItsFor: "Learners deciding what to explore next.",
    questionItAnswers: "What markets should I look at, and with what caution?",
    learnPath: "/all-topics?topic=investing",
    keywords: ["markets", "stocks", "etf", "crypto", "indices"],
    activityStorageKey: "monevo:tools:activity:market-explorer",
  },
  {
    id: "next-steps",
    title: "What Should I Do Next?",
    description: "Personalized recommendations based on your progress",
    promise: "Get 1–3 focused recommendations to take your next step.",
    mostUsefulFor: "Anyone who wants a clear next move.",
    group: "decide-next",
    route: "next-steps",
    component: NextStepsEngine,
    whatItDoes: "Suggests 1–3 focused next actions based on your activity.",
    sampleUseCase: "Get a short list of learning and tool steps that matter.",
    whoItsFor: "Anyone who wants clear, prioritized next steps.",
    questionItAnswers: "What’s my next best move right now?",
    learnPath: "/all-topics?topic=planning",
    keywords: ["recommendations", "next steps", "plan"],
    activityStorageKey: "monevo:tools:activity:next-steps",
  },
];

export const toolGroups = [
  {
    id: "understand-world" as const,
    title: "Understand the World",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=180&fit=crop",
    imageAlt: "Global economy and markets",
  },
  {
    id: "understand-myself" as const,
    title: "Understand Myself",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=180&fit=crop",
    imageAlt: "Personal finance and goals",
  },
  {
    id: "decide-next" as const,
    title: "Decide What to Do",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=180&fit=crop",
    imageAlt: "Next steps and decisions",
  },
].map((group) => ({
  ...group,
  tools: toolsRegistry.filter((tool) => tool.group === group.id),
}));

export const toolByRoute = new Map(
  toolsRegistry.map((tool) => [tool.route, tool])
);
