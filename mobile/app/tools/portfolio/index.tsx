import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiClient, requestAiTutorResponse } from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import {
  spacing,
  typography,
  radius,
  shadows,
} from "../../../src/theme/tokens";
import {
  formatCurrency,
  formatPercent,
  inferAssetType,
  CRYPTO_SYMBOLS,
  COINGECKO_ID_MAP,
  PIE_COLORS,
} from "../../../src/types/portfolio";
import type {
  PortfolioEntry,
  PortfolioSummary,
  PortfolioInsight,
  InsightCard,
} from "../../../src/types/portfolio";
import { PortfolioSkeleton } from "../../../src/components/tools/portfolio/PortfolioSkeleton";
import { SummaryHeader } from "../../../src/components/tools/portfolio/SummaryHeader";
import { PortfolioPieChart } from "../../../src/components/tools/portfolio/PieChart";
import { HoldingCard } from "../../../src/components/tools/portfolio/HoldingCard";
import { InsightCard as InsightCardComponent } from "../../../src/components/tools/portfolio/InsightCard";
import { AddEntrySheet } from "../../../src/components/tools/portfolio/AddEntrySheet";
import { AiExplanationSheet } from "../../../src/components/tools/portfolio/AiExplanationSheet";

// ─── Allocation bar component ────────────────────────────────────────────────

function AllocationBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const c = useThemeColors();
  const pct = total > 0 ? (value / total) * 100 : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct / 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  return (
    <View style={barStyles.wrapper}>
      <View style={barStyles.labelRow}>
        <View style={[barStyles.dot, { backgroundColor: color }]} />
        <Text style={[barStyles.label, { color: c.text }]}>{label}</Text>
        <Text style={[barStyles.pct, { color: c.textMuted }]}>
          {pct.toFixed(1)}%
        </Text>
      </View>
      <View style={[barStyles.track, { backgroundColor: c.surfaceOffset }]}>
        <Animated.View
          style={[
            barStyles.fill,
            {
              backgroundColor: color,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <Text style={[barStyles.value, { color: c.textMuted }]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: { gap: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: typography.sm, fontWeight: "600" },
  pct: { fontSize: typography.sm },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  value: { fontSize: typography.xs },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onTryStock,
  onTryCrypto,
}: {
  onTryStock: () => void;
  onTryCrypto: () => void;
}) {
  const c = useThemeColors();
  return (
    <View
      style={[
        emptyStyles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        shadows.md,
      ]}
    >
      <Text style={emptyStyles.emoji}>📊</Text>
      <Text style={[emptyStyles.title, { color: c.text }]}>
        No holdings yet
      </Text>
      <Text style={[emptyStyles.sub, { color: c.textMuted }]}>
        Add your first investment to track your portfolio's performance and get
        personalised insights.
      </Text>
      <View style={emptyStyles.demoRow}>
        <Pressable
          onPress={onTryStock}
          style={({ pressed }) => [
            emptyStyles.demoBtn,
            { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[emptyStyles.demoBtnText, { color: c.text }]}>
            Try AAPL Stock
          </Text>
        </Pressable>
        <Pressable
          onPress={onTryCrypto}
          style={({ pressed }) => [
            emptyStyles.demoBtn,
            { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[emptyStyles.demoBtnText, { color: c.text }]}>
            Try Bitcoin
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: typography.xl, fontWeight: "700" },
  sub: {
    fontSize: typography.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  demoRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  demoBtn: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  demoBtnText: { fontSize: typography.xs, fontWeight: "700" },
});

// ─── Risk badge ───────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low: { label: "Low Risk", bg: "rgba(46,125,50,0.12)", text: "#2e7d32" },
  moderate: {
    label: "Moderate Risk",
    bg: "rgba(245,158,11,0.12)",
    text: "#b45309",
  },
  high: { label: "High Risk", bg: "rgba(211,47,47,0.12)", text: "#d32f2f" },
};

const ALIGNMENT_CONFIG = {
  good_fit: { label: "Good Fit", bg: "rgba(46,125,50,0.12)", text: "#2e7d32" },
  risky: { label: "Risky", bg: "rgba(245,158,11,0.12)", text: "#b45309" },
  misaligned: {
    label: "Misaligned",
    bg: "rgba(211,47,47,0.12)",
    text: "#d32f2f",
  },
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const c = useThemeColors();

  // Data state
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sheet visibility
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiText, setAiText] = useState("");

  // Demo form prefill (passed to add sheet via a callback queue)
  const demoQueueRef = useRef<{
    asset_type: string;
    symbol: string;
    quantity: string;
    purchase_price: string;
  } | null>(null);

  // ── API helpers ──────────────────────────────────────────────────────────

  const fetchStockPrice = useCallback(
    async (symbol: string): Promise<number | null> => {
      try {
        const res = await (apiClient as any).get("/stock-price/", {
          params: { symbol },
        });
        return res.data?.price ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  const fetchCryptoPrice = useCallback(
    async (symbol: string): Promise<number | null> => {
      try {
        const normalized = symbol.trim().toLowerCase();
        const id = COINGECKO_ID_MAP[normalized] || normalized;
        const res = await (apiClient as any).get("/crypto-price/", {
          params: { id },
        });
        return res.data?.price ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  const fetchPortfolio = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await (apiClient as any).get("/portfolio/");
        const fetched = (res.data || []) as PortfolioEntry[];

        const withPrices = await Promise.all(
          fetched.map(async (entry) => {
            let currentPrice: number | null = null;
            if (entry.asset_type === "stock" || entry.asset_type === "etf") {
              currentPrice = await fetchStockPrice(entry.symbol);
            } else if (entry.asset_type === "crypto") {
              currentPrice = await fetchCryptoPrice(entry.symbol);
            }
            if (currentPrice != null) {
              const currentValue = currentPrice * entry.quantity;
              const gainLoss =
                currentValue - entry.purchase_price * entry.quantity;
              const gainLossPercentage =
                (gainLoss / (entry.purchase_price * entry.quantity)) * 100;
              return {
                ...entry,
                current_price: currentPrice,
                current_value: currentValue,
                gain_loss: gainLoss,
                gain_loss_percentage: gainLossPercentage,
              };
            }
            return entry;
          }),
        );

        setEntries(withPrices);

        const totalValue = withPrices.reduce(
          (s, e) => s + (e.current_value || 0),
          0,
        );
        const totalGainLoss = withPrices.reduce(
          (s, e) => s + (e.gain_loss || 0),
          0,
        );
        const allocation = withPrices.reduce<Record<string, number>>(
          (acc, e) => {
            acc[e.asset_type] =
              (acc[e.asset_type] || 0) + (e.current_value || 0);
            return acc;
          },
          {},
        );

        setSummary({
          total_value: totalValue,
          total_gain_loss: totalGainLoss,
          allocation,
        });
        setError(null);
      } catch {
        setError("Failed to load portfolio. Pull down to retry.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchCryptoPrice, fetchStockPrice],
  );

  // Initial load + 5-minute auto-refresh
  useEffect(() => {
    void fetchPortfolio();
    const interval = setInterval(
      () => void fetchPortfolio(true),
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchPortfolio(true);
  }, [fetchPortfolio]);

  // ── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string | number) => {
      void (async () => {
        try {
          await (apiClient as any).delete(`/portfolio/${id}/`);
          void fetchPortfolio(true);
        } catch {
          Alert.alert("Error", "Could not delete holding. Please try again.");
        }
      })();
    },
    [fetchPortfolio],
  );

  // ── Demo prefill ─────────────────────────────────────────────────────────

  const handleDemoStock = useCallback(() => {
    demoQueueRef.current = {
      asset_type: "stock",
      symbol: "AAPL",
      quantity: "10",
      purchase_price: "185",
    };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddSheetOpen(true);
  }, []);

  const handleDemoCrypto = useCallback(() => {
    demoQueueRef.current = {
      asset_type: "crypto",
      symbol: "bitcoin",
      quantity: "0.25",
      purchase_price: "34000",
    };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddSheetOpen(true);
  }, []);

  // ── Insight engine ───────────────────────────────────────────────────────

  const totalGainLossPercentage = useMemo(() => {
    if (!summary || !summary.total_value || summary.total_value === 0) return 0;
    const totalCost = entries.reduce(
      (s, e) => s + (e.purchase_price * e.quantity || 0),
      0,
    );
    if (totalCost === 0) return 0;
    return (summary.total_gain_loss / totalCost) * 100;
  }, [summary, entries]);

  const insight = useMemo((): PortfolioInsight | null => {
    if (!summary || entries.length === 0) return null;
    const total = summary.total_value || 0;
    const totalCost = entries.reduce(
      (s, e) => s + (e.purchase_price * e.quantity || 0),
      0,
    );
    const cryptoValue = summary.allocation?.crypto ?? 0;
    const stockValue = summary.allocation?.stock ?? 0;
    const cryptoPct = total > 0 ? (cryptoValue / total) * 100 : 0;

    let riskLevel: "low" | "moderate" | "high" = "low";
    const problems: string[] = [];
    const bullets: string[] = [];

    const maxSinglePct = Math.max(
      ...entries.map((e) => ((e.current_value ?? 0) / total) * 100),
      0,
    );

    if (entries.length === 1) {
      problems.push(
        "You only have one investment — this concentrates all your risk.",
      );
      riskLevel = "high";
    } else if (maxSinglePct >= 60) {
      problems.push(
        `Your largest holding is ${Math.round(maxSinglePct)}% of your portfolio — highly concentrated.`,
      );
      riskLevel = "high";
    } else if (maxSinglePct >= 40) {
      problems.push(
        `Your largest holding is ${Math.round(maxSinglePct)}% of your portfolio.`,
      );
      riskLevel = "moderate";
    }

    if (cryptoPct >= 50 && total > 0) {
      problems.push("Over half your portfolio is in crypto — high volatility.");
      if (riskLevel === "low") riskLevel = "moderate";
    }

    if (totalCost > 0 && totalGainLossPercentage < -10) {
      bullets.push(
        "Your portfolio is down on paper — consider reviewing your positions.",
      );
    }
    if (
      entries.length >= 2 &&
      Object.keys(summary.allocation || {}).length >= 2
    ) {
      bullets.push(
        `You're spread across ${Object.keys(summary.allocation).length} asset classes.`,
      );
    }
    if (total > 0 && stockValue > 0) {
      bullets.push(
        `Stocks make up ${Math.round((stockValue / total) * 100)}% of your portfolio.`,
      );
    }
    if (total > 0 && cryptoValue > 0) {
      bullets.push(
        `Crypto makes up ${Math.round((cryptoValue / total) * 100)}% of your portfolio.`,
      );
    }
    bullets.push(
      `Total portfolio value: ${formatCurrency(total)} (${totalGainLossPercentage >= 0 ? "gain" : "loss"} of ${formatPercent(Math.abs(totalGainLossPercentage), 1)})`,
    );

    let goalAlignment: "good_fit" | "risky" | "misaligned" =
      riskLevel === "high"
        ? "misaligned"
        : riskLevel === "moderate"
          ? "risky"
          : "good_fit";

    const insightCards: InsightCard[] = [];

    if (maxSinglePct >= 40) {
      insightCards.push({
        id: "concentration",
        title: "High Concentration Risk",
        meaning: `${Math.round(maxSinglePct)}% of your portfolio is in one asset.`,
        why: "A single holding dominating your portfolio means one bad event can wipe out significant value.",
        nextSteps: [
          "Consider adding 2–3 more positions",
          "Target no single holding above 25–30%",
        ],
        confidence: "high",
      });
    }

    if (entries.length < 3) {
      insightCards.push({
        id: "diversification",
        title: "Limited Diversification",
        meaning: `You have ${entries.length} holding${entries.length === 1 ? "" : "s"} — portfolios typically benefit from more variety.`,
        why: "Diversification reduces the impact of any single asset performing poorly.",
        nextSteps: [
          "Explore ETFs for instant diversification",
          "Consider adding a different asset class",
        ],
        confidence: "medium",
      });
    }

    if (cryptoPct >= 30 && total > 0) {
      insightCards.push({
        id: "volatility",
        title: "Crypto Volatility Exposure",
        meaning: `${Math.round(cryptoPct)}% of your portfolio is in crypto assets.`,
        why: "Crypto can drop 50%+ in short periods — your portfolio will see larger swings.",
        nextSteps: [
          "Review your risk tolerance",
          "Consider balancing with more stable assets",
        ],
        confidence: "high",
      });
    }

    if (totalGainLossPercentage < -10) {
      insightCards.push({
        id: "drawdown",
        title: "Portfolio in Drawdown",
        meaning: "Your portfolio is currently down more than 10% from cost.",
        why: "Drawdowns are normal, but reviewing fundamentals helps decide whether to hold or cut.",
        nextSteps: [
          "Revisit the thesis for your biggest losers",
          "Avoid emotional selling — stick to your plan",
        ],
        confidence: "medium",
      });
    }

    if (insightCards.length === 0) {
      insightCards.push({
        id: "healthy",
        title: "Portfolio Looks Balanced",
        meaning: "No major red flags detected in your current allocation.",
        why: "A diversified, low-concentration portfolio weathers market swings better.",
        nextSteps: [
          "Keep adding to your positions regularly",
          "Review allocation every 3–6 months",
        ],
        confidence: "medium",
      });
    }

    let nextAction: { type: "learn" | "adjust" | "explore"; label: string };
    if (riskLevel === "high" || entries.length === 1) {
      nextAction = { type: "learn", label: "Learn about diversification →" };
    } else if (riskLevel === "moderate" || maxSinglePct >= 40) {
      nextAction = { type: "adjust", label: "Consider rebalancing →" };
    } else {
      nextAction = { type: "explore", label: "Explore more assets →" };
    }

    return {
      riskLevel,
      biggestProblem: problems[0] ?? null,
      goalAlignment,
      summaryBullets: bullets.slice(0, 5),
      nextAction,
      insightCards: insightCards.slice(0, 5),
      confidence: "medium",
    };
  }, [summary, entries, totalGainLossPercentage]);

  // ── AI explanation ────────────────────────────────────────────────────────

  const handleAiExplain = useCallback(async () => {
    if (!summary || entries.length === 0) return;

    const topHoldings = entries
      .slice()
      .sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
      .slice(0, 3)
      .map(
        (e) =>
          `${e.symbol.toUpperCase()} (${e.asset_type}): ${formatCurrency(e.current_value || 0)}`,
      )
      .join(", ");

    const allocationSummary = Object.entries(summary.allocation || {})
      .map(([type, val]) => {
        const pct =
          summary.total_value > 0
            ? (Number(val) / summary.total_value) * 100
            : 0;
        return `${type}: ${pct.toFixed(1)}%`;
      })
      .join(", ");

    const prompt = [
      "You are a practical personal finance coach.",
      "Explain this learner's portfolio results in simple language.",
      `Total portfolio value: ${formatCurrency(summary.total_value || 0)}`,
      `Total gain/loss: ${formatCurrency(summary.total_gain_loss || 0)}`,
      `Total gain/loss percentage: ${totalGainLossPercentage.toFixed(1)}%`,
      `Allocation mix: ${allocationSummary || "N/A"}`,
      `Top holdings: ${topHoldings || "N/A"}`,
      "Return 3 short bullets:",
      "- What this means now",
      "- Biggest risk to watch",
      "- One practical next step",
      "Keep it under 120 words.",
    ].join("\n");

    setAiLoading(true);
    setAiError(null);
    setAiText("");
    setAiSheetOpen(true);

    try {
      const response = await requestAiTutorResponse(prompt);
      if (!response) throw new Error("Empty response");
      setAiText(response);
    } catch {
      setAiError(
        "Could not generate AI explanation right now. Please try again.",
      );
    } finally {
      setAiLoading(false);
    }
  }, [entries, summary, totalGainLossPercentage]);

  // ── Share / Export ────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!summary || entries.length === 0) return;
    const lines = [
      "📊 My Portfolio Summary",
      `Total Value: ${formatCurrency(summary.total_value)}`,
      `Total Gain/Loss: ${summary.total_gain_loss >= 0 ? "+" : ""}${formatCurrency(summary.total_gain_loss)} (${formatPercent(totalGainLossPercentage, 1)})`,
      "",
      "Holdings:",
      ...entries.map(
        (e) =>
          `• ${e.symbol.toUpperCase()} (${e.asset_type}) — ${e.quantity} × ${formatCurrency(e.purchase_price)}${e.current_value ? ` → ${formatCurrency(e.current_value)}` : ""}`,
      ),
    ];
    await Share.share({ message: lines.join("\n"), title: "My Portfolio" });
  }, [summary, entries, totalGainLossPercentage]);

  // ── Render ────────────────────────────────────────────────────────────────

  const allocationEntries = useMemo(
    () => Object.entries(summary?.allocation ?? {}),
    [summary],
  );

  const riskCfg = insight ? RISK_CONFIG[insight.riskLevel] : null;
  const alignCfg = insight ? ALIGNMENT_CONFIG[insight.goalAlignment] : null;

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Portfolio Analyzer" }} />
        <PortfolioSkeleton />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Portfolio Analyzer",
          headerRight: () => (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAddSheetOpen(true);
              }}
              style={{ marginRight: spacing.md, padding: spacing.xs }}
              accessibilityLabel="Add holding"
            >
              <Text
                style={{
                  color: c.primary,
                  fontSize: typography.lg,
                  fontWeight: "700",
                }}
              >
                +
              </Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={entries}
        keyExtractor={(item) =>
          String(item.id ?? `${item.symbol}-${item.quantity}`)
        }
        contentContainerStyle={[styles.list, { backgroundColor: c.bg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Error banner */}
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: c.errorBg, borderColor: c.error },
                ]}
              >
                <Text style={[styles.errorText, { color: c.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Summary header */}
            {summary && entries.length > 0 && (
              <SummaryHeader
                summary={summary}
                totalGainLossPercentage={totalGainLossPercentage}
                holdingsCount={entries.length}
              />
            )}

            {/* Empty state */}
            {entries.length === 0 && (
              <EmptyState
                onTryStock={handleDemoStock}
                onTryCrypto={handleDemoCrypto}
              />
            )}

            {/* Pie + allocation bars */}
            {summary && entries.length > 0 && allocationEntries.length > 0 && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: c.surface, borderColor: c.border },
                  shadows.sm,
                ]}
              >
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  Asset Allocation
                </Text>
                <PortfolioPieChart summary={summary} size={220} />
                <View style={[styles.divider, { backgroundColor: c.border }]} />
                <View style={styles.barsSection}>
                  {allocationEntries.map(([type, value], i) => (
                    <AllocationBar
                      key={type}
                      label={
                        type.charAt(0).toUpperCase() +
                        type.slice(1).replace("_", " ")
                      }
                      value={Number(value)}
                      total={summary.total_value}
                      color={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Insight panel */}
            {insight && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: c.surface,
                    borderWidth: 2,
                    borderColor: c.primary + "33",
                  },
                  shadows.sm,
                ]}
              >
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  Portfolio Insight
                </Text>

                {/* Badges row */}
                <View style={styles.badgeRow}>
                  {riskCfg && (
                    <View
                      style={[styles.badge, { backgroundColor: riskCfg.bg }]}
                    >
                      <Text style={[styles.badgeText, { color: riskCfg.text }]}>
                        {riskCfg.label}
                      </Text>
                    </View>
                  )}
                  {alignCfg && (
                    <View
                      style={[styles.badge, { backgroundColor: alignCfg.bg }]}
                    >
                      <Text
                        style={[styles.badgeText, { color: alignCfg.text }]}
                      >
                        {alignCfg.label}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[styles.badge, { backgroundColor: c.surfaceOffset }]}
                  >
                    <Text style={[styles.badgeText, { color: c.textMuted }]}>
                      {insight.confidence} confidence
                    </Text>
                  </View>
                </View>

                {/* Risk & problem summary */}
                <View style={styles.insightGrid}>
                  <View style={styles.insightCell}>
                    <Text style={[styles.insightLabel, { color: c.textMuted }]}>
                      Is it risky?
                    </Text>
                    <Text style={[styles.insightValue, { color: c.text }]}>
                      {insight.riskLevel === "low"
                        ? "Risk looks reasonable"
                        : insight.riskLevel === "moderate"
                          ? "Some concentration risk"
                          : "High risk — diversify"}
                    </Text>
                  </View>
                  <View style={styles.insightCell}>
                    <Text style={[styles.insightLabel, { color: c.textMuted }]}>
                      Biggest issue
                    </Text>
                    <Text style={[styles.insightValue, { color: c.text }]}>
                      {insight.biggestProblem ?? "Nothing major detected"}
                    </Text>
                  </View>
                </View>

                {/* Summary bullets */}
                <Text style={[styles.insightLabel, { color: c.textMuted }]}>
                  In plain English
                </Text>
                <View style={styles.bulletList}>
                  {insight.summaryBullets.map((b, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View
                        style={[
                          styles.bulletDot,
                          { backgroundColor: c.primary },
                        ]}
                      />
                      <Text style={[styles.bulletText, { color: c.text }]}>
                        {b}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Insight cards — horizontal scroll */}
                <Text
                  style={[
                    styles.insightLabel,
                    { color: c.textMuted, marginTop: spacing.sm },
                  ]}
                >
                  Insights you can act on
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.insightCardsRow}
                >
                  {insight.insightCards.map((card) => (
                    <InsightCardComponent key={card.id} card={card} />
                  ))}
                </ScrollView>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => {
                      void handleAiExplain();
                    }}
                    style={({ pressed }) => [
                      styles.aiBtn,
                      { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.aiBtnText, { color: c.text }]}>
                      What does this mean for me?
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.ctaBtn,
                      {
                        backgroundColor: c.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.ctaBtnText, { color: c.textOnPrimary }]}
                    >
                      {insight.nextAction.label}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Holdings header */}
            {entries.length > 0 && (
              <View style={styles.holdingsHeader}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  Holdings
                </Text>
                <View style={styles.holdingsActions}>
                  <Text style={[styles.holdingsCount, { color: c.textMuted }]}>
                    {entries.length}{" "}
                    {entries.length === 1 ? "entry" : "entries"}
                  </Text>
                  <Pressable
                    onPress={() => {
                      void handleShare();
                    }}
                    style={({ pressed }) => [
                      styles.shareBtn,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                    accessibilityLabel="Share portfolio summary"
                  >
                    <Text style={[styles.shareBtnText, { color: c.primary }]}>
                      Share
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.holdingItem}>
            <HoldingCard entry={item} onDelete={handleDelete} />
          </View>
        )}
        ListEmptyComponent={null}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      {/* FAB — Add holding */}
      {entries.length > 0 && (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddSheetOpen(true);
          }}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
            shadows.lg,
          ]}
          accessibilityLabel="Add holding"
          accessibilityRole="button"
        >
          <Text style={[styles.fabText, { color: c.textOnPrimary }]}>+</Text>
        </Pressable>
      )}

      {/* Sheets */}
      <AddEntrySheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdded={() => {
          void fetchPortfolio(true);
        }}
      />
      <AiExplanationSheet
        visible={aiSheetOpen}
        onClose={() => setAiSheetOpen(false)}
        loading={aiLoading}
        error={aiError}
        text={aiText}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  header: { gap: spacing.md, marginBottom: spacing.md },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: "700",
  },
  divider: { height: 1 },
  barsSection: { gap: spacing.md },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  insightGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  insightCell: { flex: 1, gap: spacing.xs },
  insightLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  insightValue: {
    fontSize: typography.sm,
    lineHeight: 18,
  },

  bulletList: { gap: spacing.xs },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 5,
    flexShrink: 0,
  },
  bulletText: { flex: 1, fontSize: typography.sm, lineHeight: 18 },

  insightCardsRow: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  aiBtn: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  aiBtnText: {
    fontSize: typography.xs,
    fontWeight: "600",
  },
  ctaBtn: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ctaBtnText: {
    fontSize: typography.sm,
    fontWeight: "700",
  },

  holdingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  holdingsActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  holdingsCount: { fontSize: typography.xs },
  shareBtn: { padding: spacing.xs },
  shareBtnText: { fontSize: typography.sm, fontWeight: "600" },

  holdingItem: { marginBottom: spacing.sm },

  errorBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { fontSize: typography.sm },

  fab: {
    position: "absolute",
    bottom: 32,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: {
    fontSize: typography.xxl,
    fontWeight: "700",
    lineHeight: 32,
    marginTop: -2,
  },
});
