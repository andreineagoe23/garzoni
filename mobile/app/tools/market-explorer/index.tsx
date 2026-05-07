import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  apiClient,
  fetchEntitlements,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { useQuery } from "@tanstack/react-query";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import {
  spacing,
  typography,
  radius,
  shadows,
} from "../../../src/theme/tokens";
import type {
  Asset,
  MarketTab,
  QuoteDetail,
} from "../../../src/types/market-explorer";
import { TabBar } from "../../../src/components/tools/market-explorer/TabBar";
import { AssetCard } from "../../../src/components/tools/market-explorer/AssetCard";
import { QuoteSheet } from "../../../src/components/tools/market-explorer/QuoteSheet";
import { logDevError } from "../../../src/lib/logDevError";
import { useInvalidatePortfolioTools } from "../../../src/hooks/usePortfolioToolsSync";

const PLACEHOLDER: Record<MarketTab, string> = {
  stocks: "Search stocks (e.g. AAPL)",
  crypto: "Search crypto (e.g. bitcoin)",
  forex: "Search forex (e.g. EUR/USD)",
};

function buildCryptoMapParam(rows: Asset[]): string | undefined {
  const parts: string[] = [];
  for (const a of rows) {
    const t = String(a.ticker ?? "")
      .toUpperCase()
      .trim();
    const id = a.coingecko_id?.trim().toLowerCase();
    if (t && id) {
      parts.push(`${t}:${id}`);
    }
  }
  return parts.length ? parts.join(",") : undefined;
}

export default function MarketExplorerScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const invalidatePortfolioTools = useInvalidatePortfolioTools();

  const entQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const hasPlus = ["plus", "pro"].includes(entQuery.data?.plan ?? "");

  useEffect(() => {
    if (entQuery.isFetched && !hasPlus) {
      router.replace("/(tabs)/tools");
    }
  }, [entQuery.isFetched, hasPlus, router]);

  const [tab, setTab] = useState<MarketTab>("stocks");
  const [query, setQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<QuoteDetail | null>(null);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteWarning, setQuoteWarning] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(query.trim());
    }, 400);
  }, [query]);

  const searchKey = debouncedSearch;
  const marketSearchQuery = useQuery({
    queryKey: queryKeys.marketSearch(tab, searchKey),
    queryFn: async ({ signal }) => {
      const res = await (apiClient as any).get("/market/search/", {
        params: { q: searchKey, type: tab },
        signal,
      });
      let searchResults: Asset[] = res.data?.results ?? [];
      /* Legacy clients enriched here; backend now attaches live prices — keep CG map batch as backup when any row lacks price */
      const needsFill =
        searchResults.some(
          (a) => !Number.isFinite(a.price) || (a.price ?? 0) <= 0,
        ) && searchResults.length > 0;
      if (needsFill) {
        const ids = searchResults.map((a) => a.ticker);
        const chunkSize = 20;
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          chunks.push(ids.slice(i, i + chunkSize));
        }
        const cryptoMap = buildCryptoMapParam(searchResults);
        const settled = await Promise.allSettled(
          chunks.map((slice) =>
            (apiClient as any).get("/market/quotes/", {
              params: {
                tickers: slice.join(","),
                ...(cryptoMap ? { crypto_map: cryptoMap } : {}),
              },
              signal,
            }),
          ),
        );
        const liveMap: Record<string, { price: number; change_pct: number }> =
          {};
        for (const s of settled) {
          if (s.status !== "fulfilled") continue;
          for (const row of s.value.data ?? []) {
            const key = String(row.ticker ?? "").toUpperCase();
            const px = Number(row.price);
            if (key && Number.isFinite(px) && px > 0) {
              liveMap[key] = {
                price: px,
                change_pct: Number(row.change_pct),
              };
            }
          }
        }
        searchResults = searchResults.map((a) => {
          const k = String(a.ticker ?? "").toUpperCase();
          const live = liveMap[k];
          return live
            ? { ...a, price: live.price, change_pct: live.change_pct }
            : a;
        });
      }
      return searchResults;
    },
    enabled: hasPlus && searchKey.length > 0,
    staleTime: staleTimes.marketSearch,
  });

  const results = marketSearchQuery.data ?? [];
  const searching = marketSearchQuery.isFetching;

  const partialPriceWarning = useMemo(() => {
    if (!results.length) return null;
    const missing = results.filter(
      (a) => !Number.isFinite(a.price) || (a.price ?? 0) <= 0,
    );
    if (missing.length === 0) return null;
    return `Live price unavailable for ${missing.length} result(s). Try again in a moment or open the asset for a fresh quote.`;
  }, [results]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
  }, []);

  // Re-clear debounced hook when tab changes (TabBar resets query string)
  const handleTabChange = useCallback((t: MarketTab) => {
    setTab(t);
    setQuery("");
    setDebouncedSearch("");
  }, []);

  const handleAssetPress = useCallback(async (asset: Asset) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuoteVisible(true);
    setQuoteLoading(true);
    setQuoteWarning(null);
    setSelectedAsset({ ...asset });
    try {
      const qp: Record<string, string> = {};
      if (asset.coingecko_id) {
        qp.coingecko_id = asset.coingecko_id;
      }
      const res = await (apiClient as any).get(
        `/market/quote/${encodeURIComponent(asset.ticker)}/`,
        { params: Object.keys(qp).length ? qp : undefined },
      );
      const data = res.data ?? {};
      const merged: QuoteDetail = {
        ...asset,
        ...data,
        ticker: data.ticker ?? asset.ticker,
        name: data.name ?? asset.name,
        price: typeof data.price === "number" ? data.price : asset.price,
        change_pct:
          typeof data.change_pct === "number"
            ? data.change_pct
            : asset.change_pct,
        ...(asset.coingecko_id
          ? { coingecko_id: asset.coingecko_id }
          : data.coingecko_id
            ? { coingecko_id: data.coingecko_id }
            : {}),
      };
      setSelectedAsset(merged);
      const px = Number(merged.price);
      if (!Number.isFinite(px) || px <= 0) {
        setQuoteWarning(
          "Live price unavailable. Pull to refresh or try again shortly.",
        );
      }
    } catch (e) {
      logDevError("tools/market-explorer/quote", e);
      setQuoteWarning(
        "Could not load quote. Check your connection and try again.",
      );
      setSelectedAsset({ ...asset });
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  const handleConfirmBuy = useCallback(
    async (amount: number) => {
      if (!selectedAsset) return;
      try {
        const body: Record<string, unknown> = {
          symbol: selectedAsset.ticker,
          amount_to_spend: amount,
        };
        if (selectedAsset.coingecko_id) {
          body.coingecko_id = selectedAsset.coingecko_id;
        }
        const res = await (apiClient as any).post("/paper-trade/buy/", body);
        const remaining = Number(res.data?.remaining_balance ?? 0).toFixed(2);
        Alert.alert(
          "Trade executed!",
          `Bought $${amount} of ${selectedAsset.ticker.toUpperCase()} with virtual cash.\nRemaining balance: $${remaining}`,
        );
        await invalidatePortfolioTools();
        void marketSearchQuery.refetch();
      } catch (e: unknown) {
        logDevError("tools/market-explorer/paper-buy", e);
        const err = e as { response?: { data?: { error?: string } } };
        Alert.alert(
          "Trade failed",
          err?.response?.data?.error ??
            "Could not complete purchase. Try again.",
        );
      }
    },
    [invalidatePortfolioTools, marketSearchQuery, selectedAsset],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Market Explorer" }} />
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <View style={styles.tabSection}>
          <TabBar active={tab} onChange={handleTabChange} />
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: c.surface, borderColor: c.border },
            shadows.sm,
          ]}
        >
          <Text style={[styles.searchIcon, { color: c.textFaint }]}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder={PLACEHOLDER[tab]}
            placeholderTextColor={c.textFaint}
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery("");
                setDebouncedSearch("");
              }}
            >
              <Text style={[styles.clearBtn, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          )}
        </View>

        {partialPriceWarning ? (
          <View
            style={[
              styles.warnStrip,
              { backgroundColor: c.accentMuted, borderColor: c.border },
            ]}
          >
            <Text style={[styles.warnStripText, { color: c.text }]}>
              {partialPriceWarning}
            </Text>
          </View>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) =>
            item.coingecko_id
              ? `${item.ticker}-${item.coingecko_id}`
              : item.ticker
          }
          renderItem={({ item }) => (
            <AssetCard
              asset={item}
              onPress={() => {
                void handleAssetPress(item);
              }}
            />
          )}
          refreshing={searching && searchKey.length > 0}
          onRefresh={() => void marketSearchQuery.refetch()}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              {searching ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  Searching…
                </Text>
              ) : query.trim() ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  No results for "{query}"
                </Text>
              ) : (
                <>
                  <Text style={styles.emptyIcon}>📈</Text>
                  <Text style={[styles.emptyTitle, { color: c.text }]}>
                    Search markets
                  </Text>
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>
                    Search for stocks, crypto, or forex pairs above.
                  </Text>
                </>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>

      <QuoteSheet
        quote={selectedAsset}
        visible={quoteVisible}
        loading={quoteLoading}
        quoteWarning={quoteWarning}
        onClose={() => {
          setQuoteVisible(false);
          setQuoteWarning(null);
        }}
        onConfirmBuy={handleConfirmBuy}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: typography.base },
  clearBtn: { fontSize: typography.sm, padding: spacing.xs },
  warnStrip: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  warnStripText: { fontSize: typography.xs, lineHeight: 17 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  empty: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xxxxl },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.lg, fontWeight: "700" },
  emptyText: { fontSize: typography.sm, textAlign: "center" },
});
