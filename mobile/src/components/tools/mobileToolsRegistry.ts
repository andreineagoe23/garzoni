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
    subtitle: "Savings & goals sanity check",
  },
  {
    id: "calendar",
    route: "calendar",
    title: "Economic calendar",
    subtitle: "Key macro events",
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
  {
    id: "market-explorer",
    route: "market-explorer",
    title: "Market explorer",
    subtitle: "Indices, ETFs, crypto",
    plusOnly: true,
  },
  {
    id: "next-steps",
    route: "next-steps",
    title: "Next steps",
    subtitle: "Personalized actions",
  },
];
