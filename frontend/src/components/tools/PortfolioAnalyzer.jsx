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

const COLORS = ["#2563eb", "#00C49F", "#FFBB28", "#FF8042"];

function PortfolioAnalyzer() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

      const entriesWithPrices = await Promise.all(
        entriesRes.data.map(async (entry) => {
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

      const allocation = entriesWithPrices.reduce((acc, entry) => {
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
      setError("Failed to fetch portfolio data. Please try again later.");
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
      setError("Failed to add portfolio entry");
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
      setError("Failed to delete portfolio entry");
      console.error(err);
    }
  };

  const chartData = useMemo(() => {
    if (!summary?.allocation) return [];
    return Object.entries(summary.allocation).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(value),
    }));
  }, [summary]);

  const totalGainLossPercentage = useMemo(() => {
    if (!summary || !summary.total_value || summary.total_value === 0) return 0;
    const totalCost = entries.reduce(
      (sum, entry) => sum + (entry.purchase_price * entry.quantity || 0),
      0
    );
    if (totalCost === 0) return 0;
    return ((summary.total_gain_loss / totalCost) * 100).toFixed(2);
  }, [summary, entries]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        Loading portfolio data...
      </div>
    );
  }

  const hasEntries = entries.length > 0;

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
          Portfolio Analyzer
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Track your investments, monitor performance, and analyze your asset allocation.
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
              Start Tracking Your Portfolio
            </h4>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Add your first investment to begin tracking performance, gains/losses, and asset allocation.
              You can track stocks and cryptocurrencies.
            </p>
            <div className="mt-6 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-2">
                Quick Tips:
              </p>
              <ul className="space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                <li>• Use stock symbols like AAPL, MSFT, GOOGL</li>
                <li>• Use crypto symbols like BTC, ETH, SOL</li>
                <li>• Enter the exact purchase price and quantity</li>
                <li>• Track your gains/losses in real-time</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {summary && hasEntries && (
        <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
              Total Portfolio Value
            </h4>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                ${summary.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                Current market value
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
              Total Gain/Loss
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
                ${summary.total_gain_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`text-xs ${
                summary.total_gain_loss >= 0
                  ? "text-emerald-600"
                  : "text-[color:var(--error,#dc2626)]"
              }`}>
                {totalGainLossPercentage >= 0 ? "+" : ""}{totalGainLossPercentage}%
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] mb-4">
              Total Holdings
            </h4>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                {entries.length}
              </p>
              <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                {entries.length === 1 ? "investment" : "investments"}
              </p>
            </div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)] mb-4">
              Asset Allocation
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
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)] mb-4">
              Portfolio Breakdown
            </h4>
            <div className="space-y-3">
              {Object.entries(summary.allocation).map(([type, value]) => {
                const percentage = ((value / summary.total_value) * 100).toFixed(1);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[color:var(--text-color,#111827)] capitalize">
                        {type}
                      </span>
                      <span className="text-[color:var(--muted-text,#6b7280)]">
                        {percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                      <div
                        className="h-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
        </>
      )}

      <div className={`grid gap-6 ${hasEntries ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
        <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
            Add New Entry
          </h4>
          <form
            onSubmit={handleSubmit}
            className="mt-4 space-y-4"
            noValidate
          >
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Asset Type
              <select
                name="asset_type"
                value={newEntry.asset_type}
                onChange={handleInputChange}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                <option value="stock">Stock</option>
                <option value="crypto">Crypto</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Symbol
              <input
                type="text"
                name="symbol"
                value={newEntry.symbol}
                onChange={handleInputChange}
                placeholder="e.g., AAPL, BTC"
                required
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
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
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
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
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
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
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              Add Entry
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              Portfolio Entries
            </h4>
            {hasEntries && (
              <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                {entries.length} {entries.length === 1 ? 'holding' : 'holdings'}
              </span>
            )}
          </div>

          {hasEntries ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)]">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Symbol</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Purchase Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Current Value
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                        Gain/Loss
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]">
                    {entries.map((entry) => {
                      const totalCost = entry.purchase_price * entry.quantity;
                      return (
                        <tr key={entry.id} className="text-[color:var(--text-color,#111827)] hover:bg-[color:var(--input-bg,#f9fafb)] transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-[color:var(--input-bg,#f3f4f6)] px-2.5 py-0.5 text-xs font-medium capitalize text-[color:var(--text-color,#111827)]">
                              {entry.asset_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">{entry.symbol.toUpperCase()}</td>
                          <td className="px-4 py-3">{entry.quantity}</td>
                          <td className="px-4 py-3">
                            ${Number(entry.purchase_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            ${entry.current_value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
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
                                ${entry.gain_loss?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                              </span>
                              <span className={`text-xs ${
                                entry.gain_loss >= 0
                                  ? "text-emerald-600"
                                  : "text-[color:var(--error,#dc2626)]"
                              }`}>
                                {entry.gain_loss_percentage >= 0 ? "+" : ""}
                                {entry.gain_loss_percentage?.toFixed(2) || "0.00"}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete ${entry.symbol}?`)) {
                                  handleDelete(entry.id);
                                }
                              }}
                              className="rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 text-xs font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-6 py-8 text-center">
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                No portfolio entries yet. Add your first investment using the form on the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PortfolioAnalyzer;
