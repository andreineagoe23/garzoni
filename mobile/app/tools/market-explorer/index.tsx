import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [buyAmount, setBuyAmount] = useState("500");
  const [buyLoading, setBuyLoading] = useState(false);

  const search = useCallback(async (q: string, t: MarketTab) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await (apiClient as any).get("/market/search/", {
        params: { q: q.trim(), type: t },
      });
      setResults(res.data?.results ?? []);
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
    setSelectedAsset(null);
    try {
      const res = await (apiClient as any).get(
        `/market/quote/${asset.ticker}/`,
      );
      setSelectedAsset(res.data ?? asset);
    } catch (e) {
      logDevError("tools/market-explorer/quote", e);
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

  const handleBuyVirtual = useCallback(() => {
    setBuyAmount("500");
    setBuyModalVisible(true);
  }, []);

  const handleConfirmBuy = useCallback(async () => {
    if (!selectedAsset) return;
    const amount = Number(buyAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a positive dollar amount.");
      return;
    }
    setBuyLoading(true);
    try {
      const res = await (apiClient as any).post("/paper-trade/buy/", {
        symbol: selectedAsset.ticker,
        amount_to_spend: amount,
      });
      const remaining = Number(res.data?.remaining_balance ?? 0).toFixed(2);
      setBuyModalVisible(false);
      Alert.alert(
        "Trade executed!",
        `Bought $${amount} of ${selectedAsset.ticker.toUpperCase()} with virtual cash.\nRemaining balance: $${remaining}`,
      );
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? "Could not execute trade. Try again.";
      Alert.alert("Trade failed", msg);
    } finally {
      setBuyLoading(false);
    }
  }, [selectedAsset, buyAmount]);

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
        onClose={() => setQuoteVisible(false)}
        onBuyVirtual={handleBuyVirtual}
      />

      {/* Buy with Virtual Cash modal */}
      <Modal
        visible={buyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBuyModalVisible(false)}
      >
        <Pressable
          style={buyStyles.backdrop}
          onPress={() => setBuyModalVisible(false)}
        />
        <View style={[buyStyles.card, { backgroundColor: c.surface }]}>
          <Text style={[buyStyles.title, { color: c.text }]}>
            Buy {selectedAsset?.ticker?.toUpperCase()} with Virtual Cash
          </Text>
          <Text style={[buyStyles.label, { color: c.textMuted }]}>
            Dollar amount to spend
          </Text>
          <TextInput
            style={[
              buyStyles.input,
              { color: c.text, borderColor: c.border, backgroundColor: c.bg },
            ]}
            value={buyAmount}
            onChangeText={setBuyAmount}
            keyboardType="numeric"
            placeholder="500"
            placeholderTextColor={c.textFaint}
            selectTextOnFocus
          />
          <View style={buyStyles.actions}>
            <Pressable
              onPress={() => setBuyModalVisible(false)}
              style={[buyStyles.btn, { borderColor: c.border, borderWidth: 1 }]}
            >
              <Text style={[buyStyles.btnText, { color: c.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleConfirmBuy()}
              disabled={buyLoading}
              style={[buyStyles.btn, { backgroundColor: c.primary }]}
            >
              <Text style={[buyStyles.btnText, { color: "#fff" }]}>
                {buyLoading ? "Buying…" : "Buy"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const buyStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "35%",
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 16, fontWeight: "700" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnText: { fontSize: 14, fontWeight: "700" },
});

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
