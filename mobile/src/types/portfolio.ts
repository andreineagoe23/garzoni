export type PortfolioEntry = {
  id?: string | number;
  asset_type: string;
  symbol: string;
  quantity: number;
  purchase_price: number;
  purchase_date?: string;
  current_price?: number;
  current_value?: number;
  gain_loss?: number;
  gain_loss_percentage?: number;
  /** Present on paper-trade rows from the API. */
  is_paper_trade?: boolean;
};

export type PortfolioSummary = {
  total_value: number;
  total_gain_loss: number;
  allocation: Record<string, number>;
};

export type NewEntryForm = {
  asset_type: string;
  symbol: string;
  quantity: string;
  purchase_price: string;
  purchase_date: string;
};

export type RiskLevel = "low" | "moderate" | "high";
export type GoalAlignment = "good_fit" | "risky" | "misaligned";
export type InsightConfidence = "low" | "medium" | "high";

export type InsightCard = {
  id: string;
  title: string;
  meaning: string;
  why: string;
  nextSteps: string[];
  confidence: InsightConfidence;
};

export type PortfolioInsight = {
  riskLevel: RiskLevel;
  biggestProblem: string | null;
  goalAlignment: GoalAlignment;
  summaryBullets: string[];
  nextAction: {
    type: "learn" | "adjust" | "explore";
    label: string;
  };
  insightCards: InsightCard[];
  confidence: InsightConfidence;
};

export const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "crypto", label: "Crypto" },
  { value: "etf", label: "ETF" },
  { value: "bond", label: "Bond" },
  { value: "fund", label: "Fund" },
  { value: "commodity", label: "Commodity" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
] as const;

export const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  crypto: "Crypto",
  etf: "ETF",
  bond: "Bond",
  fund: "Fund",
  commodity: "Commodity",
  real_estate: "Real Estate",
  other: "Other",
};

export const CRYPTO_SYMBOLS = new Set([
  "btc",
  "bitcoin",
  "eth",
  "ethereum",
  "sol",
  "solana",
  "xrp",
  "ripple",
  "ada",
  "cardano",
  "doge",
  "dogecoin",
  "bnb",
  "binancecoin",
  "matic",
  "dot",
  "polkadot",
  "avax",
  "avalanche",
  "link",
  "chainlink",
  "uni",
  "uniswap",
  "atom",
  "cosmos",
  "ltc",
  "litecoin",
  "near",
  "fil",
  "filecoin",
  "apt",
  "aptos",
  "arb",
  "arbitrum",
  "op",
  "optimism",
  "sui",
  "stx",
  "stacks",
  "ftm",
  "fantom",
]);

export const COINGECKO_ID_MAP: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  xrp: "ripple",
  ada: "cardano",
  doge: "dogecoin",
  bnb: "binancecoin",
  matic: "matic-network",
  link: "chainlink",
  dot: "polkadot",
  avax: "avalanche-2",
  ltc: "litecoin",
  uni: "uniswap",
  atom: "cosmos",
  near: "near",
  etc: "ethereum-classic",
  xlm: "stellar",
  apt: "aptos",
  arb: "arbitrum",
  op: "optimism",
  cro: "crypto-com-chain",
};

/** Map a user-typed symbol to CoinGecko id when we don't have `coingecko_id` from search. */
export function inferCoingeckoIdFromSymbol(rawSymbol: string): string | null {
  const symbol = rawSymbol.trim().toLowerCase();
  if (!symbol) return null;
  const mapped = COINGECKO_ID_MAP[symbol];
  if (mapped) return mapped;
  const normalized = symbol.replace("/", "-");
  if (normalized.endsWith("-usd")) {
    const base = normalized.slice(0, -4);
    return COINGECKO_ID_MAP[base] ?? null;
  }
  if (normalized.endsWith("usd") && normalized.length > 3) {
    const base = normalized.slice(0, -3);
    return COINGECKO_ID_MAP[base] ?? null;
  }
  return null;
}

export function inferAssetType(symbol: string): "stock" | "crypto" {
  const s = (symbol || "").trim().toLowerCase();
  return s && CRYPTO_SYMBOLS.has(s) ? "crypto" : "stock";
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export const PIE_COLORS = ["#1d5330", "#ffd700", "#2e7d32", "#f59e0b"];
