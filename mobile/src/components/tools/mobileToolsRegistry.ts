export type MobileToolDef = {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  plusOnly?: boolean;
};

/** Subset aligned with web `toolsRegistry` routes for WebView deep links. */
export const MOBILE_TOOLS: MobileToolDef[] = [
  {
    id: "portfolio",
    route: "portfolio",
    title: "Portfolio analyzer",
    subtitle: "Allocation & diversification check",
  },
  {
    id: "reality-check",
    route: "reality-check",
    title: "Goals reality check",
    subtitle: "Is your goal actually achievable?",
  },
  {
    id: "savings-calculator",
    route: "savings-calculator",
    title: "Savings calculator",
    subtitle: "Project compound growth instantly",
  },
  {
    id: "calendar",
    route: "calendar",
    title: "Economic calendar",
    subtitle: "Key macro events this week",
  },
  {
    id: "next-steps",
    route: "next-steps",
    title: "Next steps",
    subtitle: "Personalized daily actions",
  },
  {
    id: "market-explorer",
    route: "market-explorer",
    title: "Market explorer",
    subtitle: "Stocks, crypto & forex quotes",
    plusOnly: true,
  },
  {
    id: "basic-finance",
    route: "basic-finance",
    title: "Basic finance tools",
    subtitle: "Compound, loan, ROI & budget",
  },
  {
    id: "economic-map",
    route: "economic-map",
    title: "Economic map",
    subtitle: "Global economy snapshot",
    plusOnly: true,
  },
  {
    id: "news-context",
    route: "news-context",
    title: "News & market context",
    subtitle: "Headlines in context",
    plusOnly: true,
  },
];
