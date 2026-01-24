import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { useAuth } from "contexts/AuthContext";
import { BACKEND_URL } from "services/backendUrl";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatNumber, getLocale } from "utils/format";

const COLORS = ["#2563eb", "#00C49F", "#FFBB28", "#FF8042"];

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
  const { t } = useTranslation("tools");
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
  const { getAccessToken } = useAuth();

  const fetchStockPrice = useCallback(
    async (symbol) => {
      try {
        const response = await axios.get(`${BACKEND_URL}/stock-price/`, {
          params: { symbol },
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          withCredentials: true,
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
        const response = await axios.get(`${BACKEND_URL}/crypto-price/`, {
          params: { id: symbol },
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          withCredentials: true,
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
      const entriesRes = await axios.get(`${BACKEND_URL}/portfolio/`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });

      const fetchedEntries = (entriesRes.data || []) as PortfolioEntry[];
      const entriesWithPrices = await Promise.all(
        fetchedEntries.map(async (entry) => {
          let currentPrice = null;
          if (entry.asset_type === "stock") {
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
      }, {});

      setSummary({
        total_value: totalValue,
        total_gain_loss: totalGainLoss,
        allocation,
      });

      setError(null);
    } catch (err) {
      setError(t("portfolio.error"));
      console.error("Error fetching portfolio:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchCryptoPrice, fetchStockPrice, getAccessToken, t]);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setNewEntry((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${BACKEND_URL}/portfolio/`, newEntry, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      setNewEntry({
        asset_type: "stock",
        symbol: "",
        quantity: "",
        purchase_price: "",
        purchase_date: new Date().toISOString().split("T")[0],
      });
      fetchPortfolio();
    } catch (err) {
      const apiMessage = err.response?.data?.message || err.response?.data?.error;
      setError(
        apiMessage
          ? t(`apiMessages.${apiMessage}`, { defaultValue: apiMessage })
          : t("portfolio.addError", { defaultValue: "Failed to add portfolio entry" })
      );
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/portfolio/${id}/`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      fetchPortfolio();
    } catch (err) {
      const apiMessage = err.response?.data?.message || err.response?.data?.error;
      setError(
        apiMessage
          ? t(`apiMessages.${apiMessage}`, { defaultValue: apiMessage })
          : t("portfolio.deleteError", {
              defaultValue: "Failed to delete portfolio entry",
            })
      );
      console.error(err);
    }
  };

  const chartData = useMemo(() => {
    if (!summary?.allocation) return [];
    return Object.entries(summary.allocation).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Number(value),
    }));
  }, [summary]);

  const totalGainLossPercentage = useMemo(() => {
    if (!summary || !summary.total_value || summary.total_value === 0) return 0;
    const totalCost = entries.reduce(
      (sum, entry) => sum + (entry.purchase_price * entry.quantity || 0),
      0
    );
    if (totalCost === 0) return 0;
    return (summary.total_gain_loss / totalCost) * 100;
  }, [summary, entries]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        {t("portfolio.loading")}
      </div>
    );
  }

  const hasEntries = entries.length > 0;

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {t("portfolio.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("portfolio.subtitle")}
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
          {error}
        </div>
      )}

      {!hasEntries && !loading && (
        <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-8 py-12 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] text-center">
          <div className="mx-auto max-w-md space-y-4">
            <div className="text-6xl">📊</div>
            <h4 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
              {t("portfolio.emptyTitle")}
            </h4>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("portfolio.emptyBody")}
            </p>
            <div className="mt-6 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-2">
                {t("portfolio.tipsTitle")}
              </p>
              <ul className="space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                <li>• {t("portfolio.tipStocks")}</li>
                <li>• {t("portfolio.tipCrypto")}</li>
                <li>• {t("portfolio.tipPrice")}</li>
                <li>• {t("portfolio.tipRealTime")}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {summary && hasEntries && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div
              className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
                {t("portfolio.metrics.totalValue")}
              </h4>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                  {formatCurrency(summary.total_value || 0, "USD", locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("portfolio.metrics.currentValue")}
                </p>
              </div>
            </div>

            <div
              className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
                {t("portfolio.metrics.totalGainLoss")}
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
              className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
                Total Holdings
              </h4>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                  {entries.length}
                </p>
                <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("portfolio.metrics.investmentCount", {
                    count: entries.length,
                  })}
                </p>
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div
              className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-base font-semibold text-[color:var(--accent,#111827)] mb-4">
                {t("portfolio.metrics.allocation")}
              </h4>
              <div className="h-64 w-full">
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
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div
              className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h4 className="text-base font-semibold text-[color:var(--accent,#111827)] mb-4">
                {t("portfolio.metrics.breakdown")}
              </h4>
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
                        <span className="font-medium text-[color:var(--text-color,#111827)] capitalize">
                          {t(`portfolio.assetTypes.${type}`, {
                            defaultValue: type,
                          })}
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
        </>
      )}

      <div
        className={`grid gap-6 ${
          hasEntries ? "lg:grid-cols-[320px_minmax(0,1fr)]" : "lg:grid-cols-1"
        }`}
      >
        <div
          className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
            {t("portfolio.form.title")}
          </h4>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("portfolio.form.assetType")}
              <select
                name="asset_type"
                value={newEntry.asset_type}
                onChange={handleInputChange}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                <option value="stock">{t("portfolio.form.stock")}</option>
                <option value="crypto">{t("portfolio.form.crypto")}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("portfolio.form.symbol")}
              <input
                type="text"
                name="symbol"
                value={newEntry.symbol}
                onChange={handleInputChange}
                placeholder={t("portfolio.form.symbolPlaceholder")}
                required
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("portfolio.form.quantity")}
              <input
                type="number"
                name="quantity"
                value={newEntry.quantity}
                onChange={handleInputChange}
                step="any"
                required
                min="0"
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("portfolio.form.purchasePrice")}
              <input
                type="number"
                name="purchase_price"
                value={newEntry.purchase_price}
                onChange={handleInputChange}
                step="any"
                required
                min="0"
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("portfolio.form.purchaseDate")}
              <input
                type="date"
                name="purchase_date"
                value={newEntry.purchase_date}
                onChange={handleInputChange}
                required
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              {t("portfolio.form.submit")}
            </button>
          </form>
        </div>

        <div
          className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              {t("portfolio.entries.title")}
            </h4>
            {hasEntries && (
              <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                {t("portfolio.entries.count", { count: entries.length })}
              </span>
            )}
          </div>

          {hasEntries ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)]">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.type")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.symbol")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.quantity")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.purchasePrice")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.currentValue")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.gainLoss")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        {t("portfolio.entries.headers.actions")}
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
                          <span className="inline-flex items-center rounded-full bg-[color:var(--input-bg,#f3f4f6)] px-2.5 py-0.5 text-xs font-medium capitalize text-[color:var(--text-color,#111827)]">
                            {t(`portfolio.assetTypes.${entry.asset_type}`, {
                              defaultValue: entry.asset_type,
                            })}
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
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatCurrency(
                            Number(entry.current_value || 0),
                            "USD",
                            locale,
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
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
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
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
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
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
                                  t("portfolio.entries.deleteConfirm", {
                                    symbol: entry.symbol,
                                  })
                                )
                              ) {
                                handleDelete(entry.id);
                              }
                            }}
                            className="rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 text-xs font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                          >
                            {t("portfolio.entries.delete")}
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
                {t("portfolio.entries.empty")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PortfolioAnalyzer;
