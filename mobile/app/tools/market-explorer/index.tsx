import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,

  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiClient } from "@garzoni/core";
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

const PLACEHOLDER: Record<MarketTab, string> = {
  stocks: "Search stocks (e.g. AAPL)",
  crypto: "Search crypto (e.g. bitcoin)",
  forex: "Search forex (e.g. EUR/USD)",
};

export default function MarketExplorerScreen() {
  const c = useThemeColors();
  const [tab, setTab] = useState<MarketTab>("stocks");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Asset[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<QuoteDetail | null>(null);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteWarning, setQuoteWarning] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenerationRef = useRef(0);

  const search = useCallback(async (q: string, t: MarketTab) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const gen = ++searchGenerationRef.current;
    setSearching(true);
    try {
      const res = await (apiClient as any).get("/market/search/", {
        params: { q: q.trim(), type: t },
      });
      if (searchGenerationRef.current !== gen) return;
      const searchResults: Asset[] = res.data?.results ?? [];
      setResults(searchResults);

      // Enrich with live prices asynchronously — don't block the list render.
      // Backend caps ?tickers= at 20 per request; merge case-insensitively by ticker.
      if (searchResults.length > 0) {
        const ids = searchResults.map((a) => a.ticker);
        const chunkSize = 20;
        void (async () => {
          try {
            const chunks: string[][] = [];
            for (let i = 0; i < ids.length; i += chunkSize) {
              chunks.push(ids.slice(i, i + chunkSize));
            }
            const settled = await Promise.allSettled(
              chunks.map((slice) =>
                (apiClient as any).get("/market/quotes/", {
                  params: { tickers: slice.join(",") },
                }),
              ),
            );
            if (searchGenerationRef.current !== gen) return;
            const liveMap: Record<string, { price: number; change_pct: number }> = {};
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
            if (searchGenerationRef.current !== gen) return;
            setResults((prev) =>
              prev.map((a) => {
                const k = String(a.ticker ?? "").toUpperCase();
                const live = liveMap[k];
                return live
                  ? { ...a, price: live.price, change_pct: live.change_pct }
                  : a;
              }),
            );
          } catch {
            // Live price enrichment is best-effort; stale prices remain visible
          }
        })();
      }
    } catch (e) {
      logDevError("tools/market-explorer/search", e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void search(text, tab);
      }, 400);
    },
    [search, tab],
  );

  // Re-search when tab changes
  useEffect(() => {
    if (query.trim()) {
      void search(query, tab);
    }
  }, [tab, query, search]);

  const handleAssetPress = useCallback(async (asset: Asset) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuoteVisible(true);
    setQuoteLoading(true);
    setQuoteWarning(null);
    setSelectedAsset({ ...asset });
    try {
      const res = await (apiClient as any).get(
        `/market/quote/${encodeURIComponent(asset.ticker)}/`,
      );
      const data = res.data ?? {};
      const merged: QuoteDetail = {
        ...asset,
        ...data,
        ticker: data.ticker ?? asset.ticker,
        name: data.name ?? asset.name,
        price: typeof data.price === "number" ? data.price : asset.price,
        change_pct:
          typeof data.change_pct === "number" ? data.change_pct : asset.change_pct,
      };
      setSelectedAsset(merged);
      const px = Number(merged.price);
      if (!Number.isFinite(px) || px <= 0) {
        setQuoteWarning(
          "Live price unavailable. Pull to refresh the search or try again.",
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

  const handleTabChange = useCallback((t: MarketTab) => {
    setTab(t);
    setResults([]);
    setQuery("");
  }, []);

  const handleConfirmBuy = useCallback(async (amount: number) => {
    if (!selectedAsset) return;
    const res = await (apiClient as any).post("/paper-trade/buy/", {
      symbol: selectedAsset.ticker,
      amount_to_spend: amount,
    });
    const remaining = Number(res.data?.remaining_balance ?? 0).toFixed(2);
    Alert.alert(
      "Trade executed!",
      `Bought $${amount} of ${selectedAsset.ticker.toUpperCase()} with virtual cash.\nRemaining balance: $${remaining}`,
    );
  }, [selectedAsset]);

  return (
    <>
      <Stack.Screen options={{ title: "Market Explorer" }} />
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        {/* Tab bar */}
        <View style={styles.tabSection}>
          <TabBar active={tab} onChange={handleTabChange} />
        </View>

        {/* Search bar */}
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
                setResults([]);
              }}
            >
              <Text style={[styles.clearBtn, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Results */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.ticker}
          renderItem={({ item }) => (
            <AssetCard
              asset={item}
              onPress={() => {
                void handleAssetPress(item);
              }}
            />
          )}
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
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  empty: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xxxxl },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.lg, fontWeight: "700" },
  emptyText: { fontSize: typography.sm, textAlign: "center" },
});
