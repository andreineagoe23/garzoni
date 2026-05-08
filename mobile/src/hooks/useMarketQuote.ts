import type { QueryClient } from "@tanstack/react-query";
import { apiClient, queryKeys, staleTimes } from "@garzoni/core";

/** Raw row from GET `/market/quote/:ticker/` */
export type MarketQuoteApiRow = Record<string, unknown> & {
  price?: number;
  change_pct?: number;
  ticker?: string;
  name?: string;
  coingecko_id?: string;
};

export async function fetchMarketQuoteApi(params: {
  ticker: string;
  coingeckoId?: string | null;
  /** Only for explicit user retry / refresh — avoids busting cache on every tap. */
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<MarketQuoteApiRow> {
  const t = params.ticker.trim().toUpperCase();
  const qp: Record<string, string> = {};
  if (params.coingeckoId?.trim()) {
    qp.coingecko_id = params.coingeckoId.trim().toLowerCase();
  }
  if (params.forceRefresh) {
    qp.force_refresh = "1";
  }
  const res = await (apiClient as any).get(
    `/market/quote/${encodeURIComponent(t)}/`,
    {
      params: Object.keys(qp).length ? qp : undefined,
      signal: params.signal,
    },
  );
  return (res.data ?? {}) as MarketQuoteApiRow;
}

export function getMarketQuoteQueryOptions(base: {
  ticker: string;
  coingeckoId?: string | null;
}) {
  const ticker = base.ticker.trim().toUpperCase();
  const cgRaw = base.coingeckoId?.trim().toLowerCase() ?? "";
  const key = cgRaw
    ? queryKeys.marketQuote(ticker, cgRaw)
    : queryKeys.marketQuote(ticker);
  return {
    queryKey: key,
    staleTime: staleTimes.marketQuote,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchMarketQuoteApi({
        ticker,
        coingeckoId: cgRaw || null,
        forceRefresh: false,
        signal,
      }),
  };
}

/** Invalidate cached quote then fetch with `force_refresh` (explicit retry only). */
export async function fetchMarketQuoteFresh(
  queryClient: QueryClient,
  base: { ticker: string; coingeckoId?: string | null },
): Promise<MarketQuoteApiRow> {
  const ticker = base.ticker.trim().toUpperCase();
  const cgRaw = base.coingeckoId?.trim().toLowerCase() ?? "";
  const key = cgRaw
    ? queryKeys.marketQuote(ticker, cgRaw)
    : queryKeys.marketQuote(ticker);
  await queryClient.invalidateQueries({
    queryKey: key,
  });
  return queryClient.fetchQuery({
    queryKey: key,
    staleTime: staleTimes.marketQuote,
    queryFn: ({ signal }) =>
      fetchMarketQuoteApi({
        ticker,
        coingeckoId: cgRaw || null,
        forceRefresh: true,
        signal,
      }),
  });
}
