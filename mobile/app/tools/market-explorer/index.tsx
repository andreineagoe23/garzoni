import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { apiClient } from '@garzoni/core';
import { useThemeColors } from '../../../src/theme/ThemeContext';
import { spacing, typography, radius, shadows } from '../../../src/theme/tokens';
import type { Asset, MarketTab, QuoteDetail } from '../../../src/types/market-explorer';
import { TabBar } from '../../../src/components/tools/market-explorer/TabBar';
import { AssetCard } from '../../../src/components/tools/market-explorer/AssetCard';
import { QuoteSheet } from '../../../src/components/tools/market-explorer/QuoteSheet';

const PLACEHOLDER: Record<MarketTab, string> = {
  stocks: 'Search stocks (e.g. AAPL)',
  crypto: 'Search crypto (e.g. bitcoin)',
  forex: 'Search forex (e.g. EUR/USD)',
};

export default function MarketExplorerScreen() {
  const c = useThemeColors();
  const [tab, setTab] = useState<MarketTab>('stocks');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<QuoteDetail | null>(null);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string, t: MarketTab) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await (apiClient as any).get('/market/search/', {
          params: { q: q.trim(), type: t },
        });
        setResults(res.data?.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void search(text, tab);
      }, 400);
    },
    [search, tab]
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
      const res = await (apiClient as any).get(`/market/quote/${asset.ticker}/`);
      setSelectedAsset(res.data ?? asset);
    } catch {
      setSelectedAsset({ ...asset });
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((t: MarketTab) => {
    setTab(t);
    setResults([]);
    setQuery('');
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Market Explorer' }} />
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        {/* Tab bar */}
        <View style={styles.tabSection}>
          <TabBar active={tab} onChange={handleTabChange} />
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: c.surface, borderColor: c.border }, shadows.sm]}>
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
            <Pressable onPress={() => { setQuery(''); setResults([]); }}>
              <Text style={[styles.clearBtn, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Results */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.ticker}
          renderItem={({ item }) => (
            <AssetCard asset={item} onPress={() => { void handleAssetPress(item); }} />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              {searching ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>Searching…</Text>
              ) : query.trim() ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>No results for "{query}"</Text>
              ) : (
                <>
                  <Text style={styles.emptyIcon}>📈</Text>
                  <Text style={[styles.emptyTitle, { color: c.text }]}>Search markets</Text>
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
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabSection: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxxl },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '700' },
  emptyText: { fontSize: typography.sm, textAlign: 'center' },
});
