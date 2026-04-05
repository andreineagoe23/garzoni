export type MarketTab = 'stocks' | 'crypto' | 'forex';

export type Asset = {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
};

export type QuoteDetail = Asset & {
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  market_cap?: number;
};

export const TAB_LABELS: Record<MarketTab, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  forex: 'Forex',
};

export function formatPrice(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
}

export function formatChangePct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
