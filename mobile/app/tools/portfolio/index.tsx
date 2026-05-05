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
  Platform,
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
import { useTheme, useThemeColors } from "../../../src/theme/ThemeContext";
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
import { logDevError } from "../../../src/lib/logDevError";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { href } from "../../../src/navigation/href";

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

// ─── Empty states ─────────────────────────────────────────────────────────────

function RealEmptyState({
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

function VirtualEmptyState({
  onExploreMarket,
}: {
  onExploreMarket: () => void;
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
      <Text style={emptyStyles.emoji}>🎯</Text>
      <View
        style={[emptyStyles.missionBadge, { backgroundColor: c.accentMuted }]}
      >
        <Text style={[emptyStyles.missionBadgeText, { color: c.accent }]}>
          MISSION AVAILABLE
        </Text>
      </View>
      <Text style={[emptyStyles.title, { color: c.text }]}>
        Make your first virtual trade
      </Text>
      <Text style={[emptyStyles.sub, { color: c.textMuted }]}>
        Buy any stock or crypto with your $10,000 virtual cash. No real money —
        just learn how markets work.
      </Text>
      <View
        style={[
          emptyStyles.rewardRow,
          { backgroundColor: c.surfaceOffset, borderColor: c.border },
        ]}
      >
        <Text style={emptyStyles.rewardEmoji}>⚡</Text>
        <Text style={[emptyStyles.rewardText, { color: c.text }]}>500 XP</Text>
        <Text style={[emptyStyles.rewardSep, { color: c.textFaint }]}>·</Text>
        <Text style={emptyStyles.rewardEmoji}>🥉</Text>
        <Text style={[emptyStyles.rewardText, { color: c.text }]}>
          First Investor Badge
        </Text>
      </View>
      <Pressable
        onPress={onExploreMarket}
        style={({ pressed }) => [
          emptyStyles.ctaBtn,
          { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[emptyStyles.ctaBtnText, { color: c.textOnPrimary }]}>
          Explore the Market →
        </Text>
      </Pressable>
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
  title: { fontSize: typography.xl, fontWeight: "700", textAlign: "center" },
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
  missionBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  missionBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rewardEmoji: { fontSize: 14 },
  rewardText: { fontSize: typography.sm, fontWeight: "700" },
  rewardSep: { fontSize: typography.sm, marginHorizontal: spacing.xs },
  ctaBtn: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  ctaBtnText: { fontSize: typography.sm, fontWeight: "700" },
});

// ─── Risk badge — built inside component (theme-aware) ───────────────────────

function useStatusConfigs() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return {
    risk: {
      low: {
        label: "Low Risk",
        bg: dark ? "rgba(74,222,128,0.14)" : "rgba(46,125,50,0.12)",
        text: dark ? "#4ade80" : "#2e7d32",
      },
      moderate: {
        label: "Moderate Risk",
        bg: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.12)",
        text: dark ? "#fbbf24" : "#b45309",
      },
      high: {
        label: "High Risk",
        bg: dark ? "rgba(248,113,113,0.14)" : "rgba(211,47,47,0.12)",
        text: dark ? "#f87171" : "#d32f2f",
      },
    },
    alignment: {
      good_fit: {
        label: "Good Fit",
        bg: dark ? "rgba(74,222,128,0.14)" : "rgba(46,125,50,0.12)",
        text: dark ? "#4ade80" : "#2e7d32",
      },
      risky: {
        label: "Risky",
        bg: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.12)",
        text: dark ? "#fbbf24" : "#b45309",
      },
      misaligned: {
        label: "Misaligned",
        bg: dark ? "rgba(248,113,113,0.14)" : "rgba(211,47,47,0.12)",
        text: dark ? "#f87171" : "#d32f2f",
      },
    },
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { risk: RISK_CONFIG, alignment: ALIGNMENT_CONFIG } = useStatusConfigs();

  // Data state
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode toggle
  const [mode, setMode] = useState<"real" | "virtual">("real");
  const [virtualBalance, setVirtualBalance] = useState<number | null>(null);

  // Sheet visibility
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

  // First trade celebration (XP banner only — confetti removed to avoid tab-bar clipping)
  const [xpBanner, setXpBanner] = useState<number | null>(null);

  const handleFirstTrade = useCallback((xpGained: number) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setXpBanner(xpGained);
    setTimeout(() => setXpBanner(null), 4000);
  }, []);

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

  /** Batch live quotes (same pipeline as Market Explorer). Backend caps at 20 tickers per request. */
  const fetchMarketQuotesMap = useCallback(
    async (tickers: string[]): Promise<Record<string, number>> => {
      const unique = [...new Set(tickers.map((t) => t.trim()).filter(Boolean))];
      const out: Record<string, number> = {};
      const chunkSize = 20;
      for (let i = 0; i < unique.length; i += chunkSize) {
        const slice = unique.slice(i, i + chunkSize);
        try {
          const res = await (apiClient as any).get("/market/quotes/", {
            params: { tickers: slice.map((s) => s.toUpperCase()).join(",") },
          });
          for (const q of res.data ?? []) {
            const key = String(q.ticker ?? "").toUpperCase();
            const price = Number(q.price);
            if (key && Number.isFinite(price) && price > 0) {
              out[key] = price;
            }
          }
        } catch (e) {
          logDevError("tools/portfolio/market-quotes", e);
        }
      }
      return out;
    },
    [],
  );

  const applyQuotesToEntries = useCallback(
    (
      fetched: PortfolioEntry[],
      quoteMap: Record<string, number>,
    ): PortfolioEntry[] => {
      return fetched.map((entry) => {
        const basis = entry.purchase_price * entry.quantity;
        const sym = entry.symbol.trim().toUpperCase();
        const quotable =
          entry.asset_type === "stock" ||
          entry.asset_type === "etf" ||
          entry.asset_type === "crypto";
        const live = quotable ? quoteMap[sym] : undefined;

        if (live != null && live > 0) {
          const currentValue = live * entry.quantity;
          const gainLoss = currentValue - basis;
          const gainLossPercentage = basis > 0 ? (gainLoss / basis) * 100 : 0;
          return {
            ...entry,
            current_price: live,
            current_value: currentValue,
            gain_loss: gainLoss,
            gain_loss_percentage: gainLossPercentage,
          };
        }

        const serverVal =
          typeof entry.current_value === "number" && entry.current_value > 0
            ? entry.current_value
            : undefined;
        const fallbackValue = serverVal ?? basis;
        const gainLoss = fallbackValue - basis;
        return {
          ...entry,
          current_value: fallbackValue,
          gain_loss: gainLoss,
          gain_loss_percentage: basis > 0 ? (gainLoss / basis) * 100 : 0,
        };
      });
    },
    [],
  );

  const fetchPortfolio = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await (apiClient as any).get("/portfolio/");
        const fetched = (res.data || []) as PortfolioEntry[];

        const quoteSymbols = fetched
          .filter(
            (e) =>
              e.asset_type === "stock" ||
              e.asset_type === "etf" ||
              e.asset_type === "crypto",
          )
          .map((e) => e.symbol);
        const quoteMap = await fetchMarketQuotesMap(quoteSymbols);
        const withPrices = applyQuotesToEntries(fetched, quoteMap);

        setEntries(withPrices);
        setError(null);

        // Fetch virtual cash balance (non-critical)
        try {
          const savingsRes = await (apiClient as any).get("/savings-account/");
          setVirtualBalance(Number(savingsRes.data?.balance ?? 0));
        } catch {
          // ignore
        }
      } catch (e) {
        logDevError("tools/portfolio/fetch", e);
        setError("Failed to load portfolio. Pull down to retry.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyQuotesToEntries, fetchMarketQuotesMap],
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
        } catch (e) {
          logDevError("tools/portfolio/delete", e);
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

  const filteredEntries = useMemo(
    () =>
      mode === "virtual"
        ? entries.filter((e) => (e as any).is_paper_trade)
        : entries.filter((e) => !(e as any).is_paper_trade),
    [entries, mode],
  );

  const filteredSummary = useMemo<PortfolioSummary | null>(() => {
    if (filteredEntries.length === 0) return null;
    const total_value = filteredEntries.reduce(
      (s, e) => s + (e.current_value ?? 0),
      0,
    );
    const total_gain_loss = filteredEntries.reduce(
      (s, e) => s + (e.gain_loss ?? 0),
      0,
    );
    const allocation = filteredEntries.reduce<Record<string, number>>(
      (acc, e) => {
        acc[e.asset_type] = (acc[e.asset_type] ?? 0) + (e.current_value ?? 0);
        return acc;
      },
      {},
    );
    return { total_value, total_gain_loss, allocation };
  }, [filteredEntries]);

  const totalGainLossPercentage = useMemo(() => {
    if (!filteredSummary || filteredSummary.total_value === 0) return 0;
    const totalCost = filteredEntries.reduce(
      (s, e) => s + (e.purchase_price * e.quantity || 0),
      0,
    );
    if (totalCost === 0) return 0;
    return (filteredSummary.total_gain_loss / totalCost) * 100;
  }, [filteredSummary, filteredEntries]);

  const insight = useMemo((): PortfolioInsight | null => {
    if (!filteredSummary || filteredEntries.length === 0) return null;
    const total = filteredSummary.total_value || 0;
    const totalCost = filteredEntries.reduce(
      (s, e) => s + (e.purchase_price * e.quantity || 0),
      0,
    );
    const cryptoValue = filteredSummary.allocation?.crypto ?? 0;
    const stockValue = filteredSummary.allocation?.stock ?? 0;
    const cryptoPct = total > 0 ? (cryptoValue / total) * 100 : 0;

    let riskLevel: "low" | "moderate" | "high" = "low";
    const problems: string[] = [];
    const bullets: string[] = [];

    const maxSinglePct = Math.max(
      ...filteredEntries.map((e) => ((e.current_value ?? 0) / total) * 100),
      0,
    );

    if (filteredEntries.length === 1) {
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
      filteredEntries.length >= 2 &&
      Object.keys(filteredSummary.allocation || {}).length >= 2
    ) {
      bullets.push(
        `You're spread across ${Object.keys(filteredSummary.allocation).length} asset classes.`,
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

    if (filteredEntries.length < 3) {
      insightCards.push({
        id: "diversification",
        title: "Limited Diversification",
        meaning: `You have ${filteredEntries.length} holding${filteredEntries.length === 1 ? "" : "s"} — portfolios typically benefit from more variety.`,
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
    if (riskLevel === "high" || filteredEntries.length === 1) {
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
  }, [filteredSummary, filteredEntries, totalGainLossPercentage]);

  // ── AI explanation ────────────────────────────────────────────────────────

  const handleAiExplain = useCallback(async () => {
    if (!filteredSummary || filteredEntries.length === 0) return;

    const topHoldings = filteredEntries
      .slice()
      .sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
      .slice(0, 3)
      .map(
        (e) =>
          `${e.symbol.toUpperCase()} (${e.asset_type}): ${formatCurrency(e.current_value || 0)}`,
      )
      .join(", ");

    const allocationSummary = Object.entries(filteredSummary.allocation || {})
      .map(([type, val]) => {
        const pct =
          filteredSummary.total_value > 0
            ? (Number(val) / filteredSummary.total_value) * 100
            : 0;
        return `${type}: ${pct.toFixed(1)}%`;
      })
      .join(", ");

    const prompt = [
      "You are a practical personal finance coach.",
      "Explain this learner's portfolio results in simple language.",
      `Total portfolio value: ${formatCurrency(filteredSummary.total_value || 0)}`,
      `Total gain/loss: ${formatCurrency(filteredSummary.total_gain_loss || 0)}`,
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
    } catch (e) {
      logDevError("tools/portfolio/ai-tutor", e);
      setAiError(
        "Could not generate AI explanation right now. Please try again.",
      );
    } finally {
      setAiLoading(false);
    }
  }, [filteredEntries, filteredSummary, totalGainLossPercentage]);

  // ── Share / Export ────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!filteredSummary || filteredEntries.length === 0) return;
    const lines = [
      "📊 My Portfolio Summary",
      `Total Value: ${formatCurrency(filteredSummary.total_value)}`,
      `Total Gain/Loss: ${filteredSummary.total_gain_loss >= 0 ? "+" : ""}${formatCurrency(filteredSummary.total_gain_loss)} (${formatPercent(totalGainLossPercentage, 1)})`,
      "",
      "Holdings:",
      ...filteredEntries.map(
        (e) =>
          `• ${e.symbol.toUpperCase()} (${e.asset_type}) — ${e.quantity} × ${formatCurrency(e.purchase_price)}${e.current_value ? ` → ${formatCurrency(e.current_value)}` : ""}`,
      ),
    ];
    await Share.share({ message: lines.join("\n"), title: "My Portfolio" });
  }, [filteredSummary, filteredEntries, totalGainLossPercentage]);

  // ── Render ────────────────────────────────────────────────────────────────

  const allocationEntries = useMemo(
    () => Object.entries(filteredSummary?.allocation ?? {}),
    [filteredSummary],
  );

  const riskCfg = insight ? RISK_CONFIG[insight.riskLevel] : null;
  const alignCfg = insight ? ALIGNMENT_CONFIG[insight.goalAlignment] : null;

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Portfolio Analyzer",
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.text,
            headerTitleStyle: {
              color: c.text,
              fontSize: 17,
              fontWeight: "600",
            },
            headerShadowVisible: false,
          }}
        />
        <PortfolioSkeleton />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={
          {
            title: "Portfolio Analyzer",
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.text,
            headerTitleStyle: {
              color: c.text,
              fontSize: 17,
              fontWeight: "600",
            },
            headerShadowVisible: false,
            headerRightContainerStyle: Platform.select({
              ios: {
                paddingRight: spacing.sm,
                justifyContent: "center",
                alignItems: "flex-end",
              },
              default: {
                paddingRight: spacing.xl,
                justifyContent: "center",
                alignItems: "flex-end",
              },
            }),
            headerRight: () => (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAddSheetOpen(true);
                }}
                accessibilityLabel="Add holding"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => ({
                  padding: 4,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={
                    Platform.OS === "ios"
                      ? { transform: [{ translateX: 1.5 }] }
                      : undefined
                  }
                >
                  <Ionicons name="add" size={22} color={c.text} />
                </View>
              </Pressable>
            ),
          } as React.ComponentProps<typeof Stack.Screen>["options"] & {
            headerRightContainerStyle?: object;
          }
        }
      />

      <FlatList
        data={filteredEntries}
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

            {/* Real / Virtual toggle */}
            <View style={styles.modeToggle}>
              {(["real", "virtual"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[
                    styles.modeBtn,
                    mode === m && { backgroundColor: c.primary },
                    mode !== m && { borderColor: c.border, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: mode === m ? "#fff" : c.textMuted },
                    ]}
                  >
                    {m === "real" ? "Real" : "Virtual"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {mode === "virtual" && virtualBalance !== null && (
              <Text style={[styles.balanceText, { color: c.textMuted }]}>
                Virtual cash:{" "}
                <Text style={{ color: c.text, fontWeight: "700" }}>
                  {formatCurrency(virtualBalance)}
                </Text>
              </Text>
            )}

            {/* Summary header */}
            {filteredSummary && filteredEntries.length > 0 && (
              <SummaryHeader
                summary={filteredSummary}
                totalGainLossPercentage={totalGainLossPercentage}
                holdingsCount={filteredEntries.length}
              />
            )}

            {/* Empty state */}
            {filteredEntries.length === 0 && mode === "virtual" && (
              <VirtualEmptyState
                onExploreMarket={() =>
                  router.push(href("/(tabs)/tools/market-explorer"))
                }
              />
            )}
            {filteredEntries.length === 0 && mode === "real" && (
              <RealEmptyState
                onTryStock={handleDemoStock}
                onTryCrypto={handleDemoCrypto}
              />
            )}

            {/* Pie + allocation bars */}
            {filteredSummary &&
              filteredEntries.length > 0 &&
              allocationEntries.length > 0 && (
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
                  {filteredSummary && (
                    <PortfolioPieChart summary={filteredSummary} size={220} />
                  )}
                  <View
                    style={[styles.divider, { backgroundColor: c.border }]}
                  />
                  <View style={styles.barsSection}>
                    {allocationEntries.map(([type, value], i) => (
                      <AllocationBar
                        key={type}
                        label={
                          type.charAt(0).toUpperCase() +
                          type.slice(1).replace("_", " ")
                        }
                        value={Number(value)}
                        total={filteredSummary?.total_value ?? 0}
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
            {filteredEntries.length > 0 && (
              <View style={styles.holdingsHeader}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  Holdings
                </Text>
                <View style={styles.holdingsActions}>
                  <Text style={[styles.holdingsCount, { color: c.textMuted }]}>
                    {filteredEntries.length}{" "}
                    {filteredEntries.length === 1 ? "entry" : "entries"}
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

      {/* Sheets */}
      <AddEntrySheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdded={() => void fetchPortfolio(true)}
        isPaperTrade={mode === "virtual"}
        onFirstTrade={handleFirstTrade}
      />
      <AiExplanationSheet
        visible={aiSheetOpen}
        onClose={() => setAiSheetOpen(false)}
        loading={aiLoading}
        error={aiError}
        text={aiText}
      />

      {/* XP earned banner */}
      {xpBanner != null && (
        <View
          pointerEvents="none"
          style={[
            xpBannerStyles.banner,
            { backgroundColor: c.surface, borderColor: c.border },
            shadows.lg,
          ]}
        >
          <Text style={xpBannerStyles.emoji}>⚡</Text>
          <Text style={[xpBannerStyles.text, { color: c.text }]}>
            +{xpBanner} XP — First Investor!
          </Text>
          <Text style={xpBannerStyles.badge}>🥉</Text>
        </View>
      )}

    </>
  );
}

const xpBannerStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    bottom: 100,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emoji: { fontSize: 20 },
  text: { flex: 1, fontSize: typography.sm, fontWeight: "700" },
  badge: { fontSize: 20 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  header: { gap: spacing.md, marginBottom: spacing.md },

  modeToggle: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  modeBtn: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modeBtnText: { fontSize: typography.sm, fontWeight: "600" },
  balanceText: { textAlign: "center", fontSize: typography.sm },

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
});
