export type ToolGroup =
  | "understand-world"
  | "understand-myself"
  | "decide-next";

export type MobileToolDef = {
  id: string;
  group: ToolGroup;
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  plusOnly?: boolean;
  estimatedMinutes?: number;
};

export const GROUP_LABELS: Record<ToolGroup, string> = {
  "understand-world": "Understand the World",
  "understand-myself": "Understand Myself",
  "decide-next": "Decide Next",
};

// economic-map and news-context deferred to PR #2 (require WebView auth bridge)
export const MOBILE_TOOLS: MobileToolDef[] = [
  {
    id: "calendar",
    group: "understand-world",
    route: "calendar",
    title: "Economic Calendar",
    subtitle: "Key macro events this week",
    icon: "CalendarDays",
    accentColor: "#01696f",
    estimatedMinutes: 6,
  },
  {
    id: "portfolio",
    group: "understand-myself",
    route: "portfolio",
    title: "Portfolio Analyzer",
    subtitle: "Allocation & diversification check",
    icon: "PieChart",
    accentColor: "#006494",
    estimatedMinutes: 12,
  },
  {
    id: "reality-check",
    group: "understand-myself",
    route: "reality-check",
    title: "Goals Reality Check",
    subtitle: "Is your goal actually achievable?",
    icon: "Target",
    accentColor: "#da7101",
    estimatedMinutes: 8,
  },
  {
    id: "market-explorer",
    group: "decide-next",
    route: "market-explorer",
    title: "Market Explorer",
    subtitle: "Stocks, crypto & forex quotes",
    icon: "TrendingUp",
    accentColor: "#01696f",
    plusOnly: true,
    estimatedMinutes: 10,
  },
  {
    id: "next-steps",
    group: "decide-next",
    route: "next-steps",
    title: "Next Steps",
    subtitle: "Personalized daily actions",
    icon: "Footprints",
    accentColor: "#7a39bb",
    estimatedMinutes: 5,
  },
];
