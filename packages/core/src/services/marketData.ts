import apiClient from "./httpClient";

export type StockQuote = {
  price: number;
  change: number;
  changePercent: string;
};

export type ForexQuote = {
  rate: number;
  change: number;
};

export type CryptoQuote = {
  price: number;
  change: number;
  marketCap: number;
};

export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  try {
    const r = await apiClient.get("/stock-price/", { params: { symbol } });
    const { price = 0, change = 0, changePercent = "0.00%" } = r.data || {};
    return { price, change, changePercent };
  } catch {
    return { price: 0, change: 0, changePercent: "0.00%" };
  }
}

export async function fetchForexQuote(
  from: string,
  to: string,
): Promise<ForexQuote> {
  try {
    const r = await apiClient.get("/forex-rate/", { params: { from, to } });
    const { rate = 0, change = 0 } = r.data || {};
    return { rate, change };
  } catch {
    return { rate: 0, change: 0 };
  }
}

export async function fetchCryptoQuote(id: string): Promise<CryptoQuote> {
  try {
    const r = await apiClient.get("/crypto-price/", { params: { id } });
    const { price = 0, change = 0, marketCap = 0 } = r.data || {};
    return { price, change, marketCap };
  } catch {
    return { price: 0, change: 0, marketCap: 0 };
  }
}

const CRYPTO_TYPOS: Record<string, string> = {
  bircoin: "bitcoin",
  bitcon: "bitcoin",
  "bit coin": "bitcoin",
  bictoin: "bitcoin",
  etherum: "ethereum",
  ethreum: "ethereum",
};

const CRYPTO_MAP: Record<string, string> = {
  bitcoin: "bitcoin",
  btc: "bitcoin",
  ethereum: "ethereum",
  eth: "ethereum",
  cardano: "cardano",
  ada: "cardano",
  "binance coin": "binancecoin",
  bnb: "binancecoin",
  solana: "solana",
  sol: "solana",
  ripple: "ripple",
  xrp: "ripple",
  dogecoin: "dogecoin",
  doge: "dogecoin",
  polkadot: "polkadot",
  dot: "polkadot",
  litecoin: "litecoin",
  ltc: "litecoin",
  chainlink: "chainlink",
  link: "chainlink",
  uniswap: "uniswap",
  uni: "uniswap",
  avalanche: "avalanche-2",
  avax: "avalanche-2",
  polygon: "matic-network",
  matic: "matic-network",
};

export function resolveCryptoId(name: string): string | null {
  const lower = name.toLowerCase().trim();
  const normalized = CRYPTO_TYPOS[lower] || lower;
  for (const [key, value] of Object.entries(CRYPTO_MAP)) {
    if (normalized.includes(key)) return value;
  }
  return null;
}

export function cryptoDisplayName(cryptoId: string): string {
  const base = cryptoId.split("-")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function normalizeCurrencyCode(code: string): string {
  const upper = code.toUpperCase();
  return upper === "LEI" ? "RON" : upper;
}
