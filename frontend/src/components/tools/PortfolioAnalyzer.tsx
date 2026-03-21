import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import toast from "react-hot-toast";
import { useAuth } from "contexts/AuthContext";
import apiClient from "services/httpClient";
import { formatCurrency, formatNumber, getLocale } from "utils/format";
import { PORTFOLIO_INSIGHT_LESSONS } from "./lessonMapping";
import { recordToolEvent } from "services/toolsAnalytics";

const COLORS = ["#1d5330", "#2e7d32", "#ffd700", "#f59e0b"];
const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:portfolio";
const EXPORT_EVENT = "monevo:tools:export";

const CRYPTO_SYMBOLS = new Set([
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
function inferAssetType(symbol: string): "stock" | "crypto" {
  const s = (symbol || "").trim().toLowerCase();
  return s && CRYPTO_SYMBOLS.has(s) ? "crypto" : "stock";
}

type PortfolioEntry = {
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
};

type PortfolioSummary = {
  total_value: number;
  total_gain_loss: number;
  allocation: Record<string, number>;
};

function PortfolioAnalyzer() {
  const { t } = useTranslation();
  const locale = getLocale();
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({
    asset_type: "stock",
    symbol: "",
    quantity: "",
    purchase_price: "",
    purchase_date: new Date().toISOString().split("T")[0],
  });
  const [lookupPrice, setLookupPrice] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const { getAccessToken, financialProfile } = useAuth();
  const formRef = useRef<HTMLDivElement | null>(null);

  const fetchStockPrice = useCallback(
    async (symbol) => {
      try {
        const response = await apiClient.get("/stock-price/", {
          params: { symbol },
        });

        return response.data?.price ?? null;
      } catch (err) {
        console.error("Error fetching stock price:", err);
        return null;
      }
    },
    [getAccessToken]
  );

  const fetchCryptoPrice = useCallback(
    async (symbol) => {
      try {
        const normalized = String(symbol || "")
          .trim()
          .toLowerCase();
        const COINGECKO_ID_MAP: Record<string, string> = {
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
        };
        const cryptoId = COINGECKO_ID_MAP[normalized] || normalized;
        const response = await apiClient.get("/crypto-price/", {
          params: { id: cryptoId },
        });
        return response.data?.price ?? null;
      } catch (err) {
        console.error("Error fetching crypto price:", err);
        return null;
      }
    },
    [getAccessToken]
  );

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      const entriesRes = await apiClient.get("/portfolio/");

      const fetchedEntries = (entriesRes.data || []) as PortfolioEntry[];
      const entriesWithPrices = await Promise.all(
        fetchedEntries.map(async (entry) => {
          let currentPrice = null;
          if (entry.asset_type === "stock" || entry.asset_type === "etf") {
            currentPrice = await fetchStockPrice(entry.symbol);
          } else if (entry.asset_type === "crypto") {
            currentPrice = await fetchCryptoPrice(entry.symbol);
          }

          if (currentPrice) {
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
        })
      );

      setEntries(entriesWithPrices);

      const totalValue = entriesWithPrices.reduce(
        (sum, entry) => sum + (entry.current_value || 0),
        0
      );
      const totalGainLoss = entriesWithPrices.reduce(
        (sum, entry) => sum + (entry.gain_loss || 0),
        0
      );

      const allocation = entriesWithPrices.reduce<Record<string, number>>(
        (acc, entry) => {
          const type = entry.asset_type;
          acc[type] = (acc[type] || 0) + (entry.current_value || 0);
          return acc;
        },
        {}
      );

      setSummary({
        total_value: totalValue,
        total_gain_loss: totalGainLoss,
        allocation,
      });

      setError(null);
    } catch (err) {
      setError(t("tools.portfolio.loadError"));
      console.error("Error fetching portfolio:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchCryptoPrice, fetchStockPrice, getAccessToken]);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: `${entries.length} holdings` })
    );
  }, [entries.length]);

  useEffect(() => {
    if (!summary || entries.length === 0 || typeof window === "undefined")
      return;
    const key = "monevo:tools:completed:portfolio";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    if (typeof window.gtag === "function") {
      window.gtag("event", "tool_completed", {
        tool_id: "portfolio",
        detail: "portfolio_summary_ready",
      });
    }
    recordToolEvent("tool_complete", "portfolio", {
      detail: "portfolio_summary_ready",
    });
  }, [summary, entries.length]);

  useEffect(() => {
    const handleExport = (event: Event) => {
      const detail = (event as CustomEvent<{ toolId?: string }>).detail;
      if (detail?.toolId !== "portfolio") return;
      if (entries.length === 0) {
        toast.error(t("tools.portfolio.exportEmpty"));
        return;
      }
      const header = [
        "Asset Type",
        "Symbol",
        "Quantity",
        "Purchase Price",
        "Purchase Date",
        "Current Price",
        "Current Value",
        "Gain/Loss",
        "Gain/Loss %",
      ];
      const rows = entries.map((entry) => [
        entry.asset_type,
        entry.symbol,
        entry.quantity,
        entry.purchase_price,
        entry.purchase_date ?? "",
        entry.current_price ?? "",
        entry.current_value ?? "",
        entry.gain_loss ?? "",
        entry.gain_loss_percentage ?? "",
      ]);
      const csv = [header, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "portfolio.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("tools.portfolio.exportReady"));
    };

    window.addEventListener(EXPORT_EVENT, handleExport as EventListener);
    return () => {
      window.removeEventListener(EXPORT_EVENT, handleExport as EventListener);
    };
  }, [entries]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setNewEntry((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "symbol") {
        setLookupPrice(null);
        setLookupError(null);
        if (prev.asset_type === "stock" || prev.asset_type === "crypto") {
          next.asset_type = inferAssetType(value);
        }
      }
      return next;
    });
  };

  const handleLookupPrice = useCallback(async () => {
    const symbol = (newEntry.symbol || "").trim();
    if (!symbol) {
      setLookupError(t("tools.portfolio.symbolRequired"));
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupPrice(null);
    const assetType = newEntry.asset_type || inferAssetType(symbol);
    try {
      if (assetType === "crypto") {
        const price = await fetchCryptoPrice(symbol);
        if (price != null) {
          setLookupPrice(price);
          setNewEntry((prev) => ({
            ...prev,
            purchase_price: String(price),
            asset_type: "crypto",
          }));
        } else {
          setLookupError(t("tools.portfolio.priceNotFound"));
        }
      } else if (assetType === "stock" || assetType === "etf") {
        const price = await fetchStockPrice(symbol.toUpperCase());
        if (price != null) {
          setLookupPrice(price);
          setNewEntry((prev) => ({
            ...prev,
            purchase_price: String(price),
            asset_type: assetType,
          }));
        } else {
          setLookupError(t("tools.portfolio.priceNotFound"));
        }
      } else {
        setLookupError(t("tools.portfolio.livePriceNotAvailable"));
      }
    } catch {
      setLookupError(t("tools.portfolio.priceNotFound"));
    } finally {
      setLookupLoading(false);
    }
  }, [
    newEntry.symbol,
    newEntry.asset_type,
    fetchCryptoPrice,
    fetchStockPrice,
    t,
  ]);

  const handleDemoEntry = (entry: {
    asset_type: string;
    symbol: string;
    quantity: string;
    purchase_price: string;
  }) => {
    setNewEntry((prev) => ({
      ...prev,
      ...entry,
      purchase_date: new Date().toISOString().split("T")[0],
    }));
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post("/portfolio/", newEntry);
      setNewEntry({
        asset_type: "stock",
        symbol: "",
        quantity: "",
        purchase_price: "",
        purchase_date: new Date().toISOString().split("T")[0],
      });
      fetchPortfolio();
      if (typeof window.gtag === "function") {
        window.gtag("event", "portfolio_entry_added", {
          tool_id: "portfolio",
        });
      }
    } catch (err) {
      const apiMessage =
        err.response?.data?.message || err.response?.data?.error;
      setError(apiMessage || t("tools.portfolio.addFailed"));
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/portfolio/${id}/`);
      fetchPortfolio();
      if (typeof window.gtag === "function") {
        window.gtag("event", "portfolio_entry_deleted", {
          tool_id: "portfolio",
        });
      }
    } catch (err) {
      const apiMessage =
        err.response?.data?.message || err.response?.data?.error;
      setError(apiMessage || t("tools.portfolio.deleteFailed"));
      console.error(err);
    }
  };

  const chartData = useMemo(() => {
    if (!summary?.allocation) return [];
    return Object.entries(summary.allocation).map(([key, value]) => ({
      name: t(`tools.portfolio.assetType.${key}`),
      value: Number(value),
    }));
  }, [summary, t]);

  const totalGainLossPercentage = useMemo(() => {
    if (!summary || !summary.total_value || summary.total_value === 0) return 0;
    const totalCost = entries.reduce(
      (sum, entry) => sum + (entry.purchase_price * entry.quantity || 0),
      0
    );
    if (totalCost === 0) return 0;
    return (summary.total_gain_loss / totalCost) * 100;
  }, [summary, entries]);

  const insight = useMemo(() => {
    if (!summary || entries.length === 0) return null;
    const total = summary.total_value || 0;
    const totalCost = entries.reduce(
      (sum, entry) => sum + (entry.purchase_price * entry.quantity || 0),
      0
    );
    const cryptoValue = summary.allocation?.crypto ?? 0;
    const stockValue = summary.allocation?.stock ?? 0;
    const cryptoPct = total > 0 ? (cryptoValue / total) * 100 : 0;

    let riskLevel: "low" | "moderate" | "high" = "low";
    const problems: string[] = [];
    const bullets: string[] = [];

    const maxSinglePct = Math.max(
      ...entries.map((e) => ((e.current_value ?? 0) / total) * 100),
      0
    );

    if (entries.length === 1) {
      problems.push(t("tools.portfolio.problems.oneInvestment"));
      riskLevel = "high";
    } else if (maxSinglePct >= 60) {
      problems.push(
        t("tools.portfolio.problems.largestHolding", {
          pct: Math.round(maxSinglePct),
        })
      );
      riskLevel = "high";
    } else if (maxSinglePct >= 40) {
      problems.push(
        t("tools.portfolio.problems.largestHoldingModerate", {
          pct: Math.round(maxSinglePct),
        })
      );
      riskLevel = "moderate";
    }

    if (cryptoPct >= 50 && total > 0) {
      problems.push(t("tools.portfolio.problems.cryptoVolatile"));
      if (riskLevel === "low") riskLevel = "moderate";
    }

    if (totalCost > 0 && totalGainLossPercentage < -10) {
      bullets.push(t("tools.portfolio.problems.downOnPaper"));
    }

    if (
      entries.length >= 2 &&
      Object.keys(summary.allocation || {}).length >= 2
    ) {
      bullets.push(t("tools.portfolio.problems.spreadAcross"));
    }
    if (total > 0 && stockValue > 0) {
      const pct = Math.round((stockValue / total) * 100);
      bullets.push(t("tools.portfolio.problems.stocksPct", { pct }));
    }
    if (total > 0 && cryptoValue > 0) {
      const pct = Math.round((cryptoValue / total) * 100);
      bullets.push(t("tools.portfolio.problems.cryptoPct", { pct }));
    }
    bullets.push(
      t("tools.portfolio.problems.totalValueBullet", {
        value: formatCurrency(total, "USD", locale, {
          maximumFractionDigits: 0,
        }),
        gainOrLoss:
          totalGainLossPercentage >= 0
            ? t("tools.portfolio.problems.gain")
            : t("tools.portfolio.problems.loss"),
        pct: formatNumber(Math.abs(totalGainLossPercentage), locale, {
          maximumFractionDigits: 1,
        }),
      })
    );

    const riskComfort = financialProfile?.risk_comfort || "";
    const timeframe = financialProfile?.timeframe || "";
    let goalAlignment: "good_fit" | "risky" | "misaligned" =
      riskLevel === "high"
        ? "misaligned"
        : riskLevel === "moderate"
          ? "risky"
          : "good_fit";

    if (riskComfort === "low" && riskLevel !== "low") {
      goalAlignment = "misaligned";
    } else if (riskComfort === "medium" && riskLevel === "high") {
      goalAlignment = "misaligned";
    }
    if (timeframe === "short_term" && riskLevel !== "low") {
      goalAlignment = "misaligned";
    } else if (timeframe === "mid_term" && riskLevel === "high") {
      goalAlignment = "risky";
    }

    const biggestProblem = problems[0] ?? null;

    const insightCards: Array<{
      id: string;
      title: string;
      meaning: string;
      why: string;
      nextSteps: string[];
      lessonLink?: string;
      actionLink?: string;
      confidence: "low" | "medium" | "high";
    }> = [];

    if (maxSinglePct >= 40) {
      insightCards.push({
        id: "concentration",
        title: t("tools.portfolio.insights.concentrationTitle"),
        meaning: t("tools.portfolio.insights.concentrationMeaning", {
          pct: Math.round(maxSinglePct),
        }),
        why: t("tools.portfolio.insights.concentrationWhy"),
        nextSteps: [
          t("tools.portfolio.insights.concentrationStep1"),
          t("tools.portfolio.insights.concentrationStep2"),
        ],
        lessonLink: PORTFOLIO_INSIGHT_LESSONS.concentration,
        actionLink: "/tools/portfolio",
        confidence: "high",
      });
    }

    if (entries.length < 3) {
      insightCards.push({
        id: "diversification",
        title: t("tools.portfolio.insights.diversificationTitle"),
        meaning: t("tools.portfolio.insights.diversificationMeaning"),
        why: t("tools.portfolio.insights.diversificationWhy"),
        nextSteps: [
          t("tools.portfolio.insights.diversificationStep1"),
          t("tools.portfolio.insights.diversificationStep2"),
        ],
        lessonLink: PORTFOLIO_INSIGHT_LESSONS.diversification,
        actionLink: "/tools/market-explorer",
        confidence: "medium",
      });
    }

    if (cryptoPct >= 30 && total > 0) {
      insightCards.push({
        id: "volatility",
        title: t("tools.portfolio.insights.volatilityTitle"),
        meaning: t("tools.portfolio.insights.volatilityMeaning", {
          pct: Math.round(cryptoPct),
        }),
        why: t("tools.portfolio.insights.volatilityWhy"),
        nextSteps: [
          t("tools.portfolio.insights.volatilityStep1"),
          t("tools.portfolio.insights.volatilityStep2"),
        ],
        lessonLink: PORTFOLIO_INSIGHT_LESSONS.volatility,
        actionLink: "/tools/market-explorer",
        confidence: "high",
      });
    }

    if (totalGainLossPercentage < -10) {
      insightCards.push({
        id: "drawdown",
        title: t("tools.portfolio.insights.drawdownTitle"),
        meaning: t("tools.portfolio.insights.drawdownMeaning"),
        why: t("tools.portfolio.insights.drawdownWhy"),
        nextSteps: [
          t("tools.portfolio.insights.drawdownStep1"),
          t("tools.portfolio.insights.drawdownStep2"),
        ],
        lessonLink: "/all-topics?topic=investing",
        actionLink: "/tools/reality-check",
        confidence: "medium",
      });
    }

    if (insightCards.length === 0) {
      insightCards.push({
        id: "healthy",
        title: t("tools.portfolio.insights.healthyTitle"),
        meaning: t("tools.portfolio.insights.healthyMeaning"),
        why: t("tools.portfolio.insights.healthyWhy"),
        nextSteps: [
          t("tools.portfolio.insights.healthyStep1"),
          t("tools.portfolio.insights.healthyStep2"),
        ],
        lessonLink: "/all-topics?topic=investing",
        actionLink: "/tools/market-explorer",
        confidence: "medium",
      });
    }

    let nextAction: {
      type: "learn" | "adjust" | "explore";
      label: string;
      href: string;
    };
    if (riskLevel === "high" || entries.length === 1) {
      nextAction = {
        type: "learn",
        label: t("tools.portfolio.learnDiversification"),
        href: "/all-topics?topic=investing",
      };
    } else if (
      riskLevel === "moderate" ||
      (biggestProblem && maxSinglePct >= 40)
    ) {
      nextAction = {
        type: "adjust",
        label: t("tools.portfolio.considerRebalancing"),
        href: "/tools/portfolio",
      };
    } else {
      nextAction = {
        type: "explore",
        label: t("tools.portfolio.exploreMarket"),
        href: "/tools/market-explorer",
      };
    }

    return {
      riskLevel,
      biggestProblem,
      goalAlignment,
      summaryBullets: bullets.slice(0, 5),
      nextAction,
      insightCards: insightCards.slice(0, 5),
      confidence: financialProfile ? "medium" : "low",
    };
  }, [summary, entries, totalGainLossPercentage, locale, financialProfile, t]);

  useEffect(() => {
    if (!insight || typeof window === "undefined") return;
    sessionStorage.setItem(
      "monevo:tools:signal:portfolio_risk",
      insight.riskLevel
    );
  }, [insight]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        {t("tools.portfolio.loading")}
      </div>
    );
  }

  const hasEntries = entries.length > 0;

  return (
    <section className="space-y-6 min-w-0 w-full">
      <header className="space-y-2 text-center">
        <h3 className="text-xl font-bold text-[color:var(--text-color,#111827)] sm:text-2xl">
          {t("tools.portfolio.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("tools.portfolio.subtitle")}
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
          {error}
        </div>
      )}

      {!hasEntries && !loading && (
        <div className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-8 sm:px-8 sm:py-12 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] text-center">
          <div className="mx-auto max-w-md space-y-4">
            <div className="text-6xl">📊</div>
            <h4 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
              {t("tools.portfolio.noEntries")}
            </h4>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.portfolio.noEntriesSubtitle")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleDemoEntry({
                    asset_type: "stock",
                    symbol: "AAPL",
                    quantity: "10",
                    purchase_price: "185",
                  })
                }
                className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
              >
                {t("tools.portfolio.loadSampleStock")}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDemoEntry({
                    asset_type: "crypto",
                    symbol: "bitcoin",
                    quantity: "0.25",
                    purchase_price: "34000",
                  })
                }
                className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
              >
                {t("tools.portfolio.loadSampleCrypto")}
              </button>
            </div>
            <div className="mt-6 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-2">
                {t("tools.portfolio.tryThis")}
              </p>
              <ul className="space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                <li>• {t("tools.portfolio.tryThisBullet1")}</li>
                <li>• {t("tools.portfolio.tryThisBullet2")}</li>
                <li>• {t("tools.portfolio.tryThisBullet3")}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {summary && hasEntries && (
        <>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
            <div
              className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
                {t("tools.portfolio.totalValue")}
              </h4>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                  {formatCurrency(summary.total_value || 0, "USD", locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("tools.portfolio.currentValue")}
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
                {t("tools.portfolio.totalGainLoss")}
              </h4>
              <div className="space-y-1">
                <p
                  className={`text-3xl font-bold ${
                    summary.total_gain_loss >= 0
                      ? "text-emerald-500"
                      : "text-[color:var(--error,#dc2626)]"
                  }`}
                >
                  {summary.total_gain_loss >= 0 ? "+" : ""}
                  {formatCurrency(
                    Math.abs(summary.total_gain_loss || 0),
                    "USD",
                    locale,
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )}
                </p>
                <p
                  className={`text-xs ${
                    summary.total_gain_loss >= 0
                      ? "text-emerald-600"
                      : "text-[color:var(--error,#dc2626)]"
                  }`}
                >
                  {totalGainLossPercentage >= 0 ? "+" : ""}
                  {formatNumber(totalGainLossPercentage, locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
                {t("tools.portfolio.totalHoldings")}
              </h4>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                  {entries.length}
                </p>
                <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                  {entries.length}{" "}
                  {entries.length === 1
                    ? t("tools.portfolio.investment_one")
                    : t("tools.portfolio.investment_other")}
                </p>
              </div>
            </div>
          </div>

          {insight && (
            <div
              className="rounded-2xl sm:rounded-3xl border-2 border-[color:var(--primary,#1d5330)]/20 bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-base font-semibold text-[color:var(--accent,#111827)] mb-4">
                {t("tools.portfolio.portfolioInsight")}
              </h4>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    insight.goalAlignment === "good_fit"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : insight.goalAlignment === "risky"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-[color:var(--error,#dc2626)]/15 text-[color:var(--error,#dc2626)]"
                  }`}
                >
                  {insight.goalAlignment === "good_fit"
                    ? t("tools.portfolio.goodFit")
                    : insight.goalAlignment === "risky"
                      ? t("tools.portfolio.risky")
                      : t("tools.portfolio.misaligned")}
                </span>
                <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {t("tools.portfolio.confidence", {
                    level: insight.confidence,
                  })}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    {t("tools.portfolio.isPortfolioRisky")}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--text-color,#111827)]">
                    {insight.riskLevel === "low"
                      ? t("tools.portfolio.riskReasonable")
                      : insight.riskLevel === "moderate"
                        ? t("tools.portfolio.riskModerate")
                        : t("tools.portfolio.riskHigh")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    {t("tools.portfolio.biggestProblem")}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--text-color,#111827)]">
                    {insight.biggestProblem ??
                      t("tools.portfolio.nothingMajor")}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {t("tools.portfolio.inPlainEnglish")}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[color:var(--text-color,#111827)]">
                  {insight.summaryBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Insights you can act on
                </p>
                <div className="mt-2 grid gap-3 grid-cols-1 md:grid-cols-2 min-w-0">
                  {insight.insightCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/90 px-4 py-4 text-sm text-[color:var(--text-color,#111827)] min-w-0"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-semibold">{card.title}</h5>
                        <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                          {card.confidence} confidence
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                        <span className="font-semibold text-[color:var(--accent,#111827)]">
                          What it means:
                        </span>{" "}
                        {card.meaning}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                        <span className="font-semibold text-[color:var(--accent,#111827)]">
                          Why it matters:
                        </span>{" "}
                        {card.why}
                      </p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                        {card.nextSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {card.lessonLink && (
                          <Link
                            to={card.lessonLink}
                            onClick={() => {
                              recordToolEvent(
                                "tool_to_lesson_click",
                                "portfolio",
                                {
                                  href: card.lessonLink,
                                  card_title: card.title,
                                }
                              );
                              if (typeof window.gtag === "function") {
                                window.gtag(
                                  "event",
                                  "lesson_started_from_tool",
                                  {
                                    tool_id: "portfolio",
                                    link: card.lessonLink,
                                  }
                                );
                              }
                            }}
                            className="text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)] hover:opacity-80"
                          >
                            Lesson →
                          </Link>
                        )}
                        {card.actionLink && (
                          <Link
                            to={card.actionLink}
                            className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] hover:text-[color:var(--primary,#1d5330)]"
                          >
                            Tool action →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Next step:
                </span>
                <Link
                  to={insight.nextAction.href}
                  className="inline-flex items-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40"
                >
                  {insight.nextAction.label} →
                </Link>
              </div>
            </div>
          )}

          {chartData.length > 0 && summary?.allocation && (
            <div
              className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-base font-semibold text-[color:var(--accent,#111827)] mb-4">
                Asset Allocation & Portfolio Breakdown
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-3">
                    Allocation
                  </p>
                  <div className="h-56 sm:h-64 w-full min-h-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) =>
                            `${name}: ${formatNumber(percent * 100, locale, {
                              maximumFractionDigits: 1,
                            })}%`
                          }
                        >
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) =>
                            formatCurrency(Number(value || 0), "USD", locale, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          }
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-3">
                    Breakdown
                  </p>
                  <div className="space-y-3">
                    {Object.entries(summary.allocation).map(([type, value]) => {
                      const percentage =
                        summary.total_value > 0
                          ? (Number(value) / summary.total_value) * 100
                          : 0;
                      const percentageLabel = formatNumber(percentage, locale, {
                        maximumFractionDigits: 1,
                      });
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-[color:var(--text-color,#111827)]">
                              {t(`tools.portfolio.assetType.${type}`)}
                            </span>
                            <span className="text-[color:var(--muted-text,#6b7280)]">
                              {percentageLabel}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                            <div
                              className="h-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                            {formatCurrency(Number(value || 0), "USD", locale, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div
        ref={formRef}
        className={`grid gap-4 sm:gap-6 min-w-0 ${
          hasEntries
            ? "lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
            : "lg:grid-cols-1"
        }`}
      >
        <div
          className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
            Add New Entry
          </h4>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Asset Type
              <select
                name="asset_type"
                value={newEntry.asset_type}
                onChange={handleInputChange}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
              >
                <option value="stock">{t("tools.portfolio.stock")}</option>
                <option value="crypto">{t("tools.portfolio.crypto")}</option>
                <option value="etf">{t("tools.portfolio.etf")}</option>
                <option value="bond">{t("tools.portfolio.bond")}</option>
                <option value="fund">{t("tools.portfolio.fund")}</option>
                <option value="commodity">
                  {t("tools.portfolio.commodity")}
                </option>
                <option value="real_estate">
                  {t("tools.portfolio.real_estate")}
                </option>
                <option value="other">{t("tools.portfolio.other")}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Symbol
              <div className="flex gap-2">
                <input
                  type="text"
                  name="symbol"
                  value={newEntry.symbol}
                  onChange={handleInputChange}
                  placeholder={t("tools.portfolio.symbolPlaceholder")}
                  required
                  className="flex-1 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                />
                <button
                  type="button"
                  onClick={handleLookupPrice}
                  disabled={lookupLoading || !newEntry.symbol.trim()}
                  className="shrink-0 rounded-full border border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)]/20 disabled:opacity-50"
                >
                  {lookupLoading
                    ? t("tools.portfolio.lookupLoading")
                    : t("tools.portfolio.getPrice")}
                </button>
              </div>
              {lookupError && (
                <p className="mt-1 text-xs text-[color:var(--error,#dc2626)]">
                  {lookupError}
                </p>
              )}
              {lookupPrice != null && !lookupError && (
                <p className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("tools.portfolio.currentPrice")}:{" "}
                  {formatCurrency(lookupPrice, "USD", locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Quantity
              <input
                type="number"
                name="quantity"
                value={newEntry.quantity}
                onChange={handleInputChange}
                step="any"
                required
                min="0"
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Purchase Price
              <input
                type="number"
                name="purchase_price"
                value={newEntry.purchase_price}
                onChange={handleInputChange}
                step="any"
                required
                min="0"
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Purchase Date
              <input
                type="date"
                name="purchase_date"
                value={newEntry.purchase_date}
                onChange={handleInputChange}
                required
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            >
              Add Entry
            </button>
          </form>
        </div>

        <div
          className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] min-w-0"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              Portfolio Entries
            </h4>
            {hasEntries && (
              <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>

          {hasEntries ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)] min-w-0">
              <div className="max-h-[400px] overflow-auto">
                <table
                  className="min-w-full border-collapse text-sm"
                  style={{ minWidth: "640px" }}
                >
                  <thead className="sticky top-0 z-10 bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Symbol
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Purchase Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Current Value
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Gain/Loss
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="text-[color:var(--text-color,#111827)] hover:bg-[color:var(--input-bg,#f9fafb)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-[color:var(--input-bg,#f3f4f6)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--text-color,#111827)]">
                            {t(`tools.portfolio.assetType.${entry.asset_type}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {entry.symbol.toUpperCase()}
                        </td>
                        <td className="px-4 py-3">{entry.quantity}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(
                            Number(entry.purchase_price || 0),
                            "USD",
                            locale,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatCurrency(
                            Number(entry.current_value || 0),
                            "USD",
                            locale,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span
                              className={`font-semibold ${
                                entry.gain_loss >= 0
                                  ? "text-emerald-500"
                                  : "text-[color:var(--error,#dc2626)]"
                              }`}
                            >
                              {entry.gain_loss >= 0 ? "+" : ""}
                              {formatCurrency(
                                Math.abs(Number(entry.gain_loss || 0)),
                                "USD",
                                locale,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                            <span
                              className={`text-xs ${
                                entry.gain_loss >= 0
                                  ? "text-emerald-600"
                                  : "text-[color:var(--error,#dc2626)]"
                              }`}
                            >
                              {entry.gain_loss_percentage >= 0 ? "+" : ""}
                              {formatNumber(
                                entry.gain_loss_percentage || 0,
                                locale,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                              %
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete ${entry.symbol.toUpperCase()}?`
                                )
                              ) {
                                handleDelete(entry.id);
                              }
                            }}
                            className="rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 text-xs font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-6 py-8 text-center">
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                No portfolio entries yet. Add your first entry above.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PortfolioAnalyzer;
