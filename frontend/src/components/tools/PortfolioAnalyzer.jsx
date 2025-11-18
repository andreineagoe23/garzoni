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

  const fetchStockPrice = async (symbol) => {
    try {
      const response = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.REACT_APP_ALPHA_VANTAGE_API_KEY}`
      );
      return parseFloat(response.data["Global Quote"]["05. price"]);
    } catch (err) {
      console.error("Error fetching stock price:", err);
      return null;
    }
  };

  const fetchCryptoPrice = async (symbol) => {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`
      );
      return response.data[symbol.toLowerCase()]?.usd || null;
    } catch (err) {
      console.error("Error fetching crypto price:", err);
      return null;
    }
  };

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      const entriesRes = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/portfolio/`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );

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
  }, [getAccessToken]);

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
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/portfolio/`,
        newEntry,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
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
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/portfolio/${id}/`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        Loading portfolio data...
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Portfolio Analyzer
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Track your investments and monitor performance at a glance.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              Portfolio Summary
            </h4>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              <p>
                Total Value:{" "}
                <span className="font-semibold text-[color:var(--accent,#111827)]">
                  ${summary.total_value.toFixed(2)}
                </span>
              </p>
              <p>
                Total Gain/Loss:{" "}
                <span
                  className={
                    summary.total_gain_loss >= 0
                      ? "font-semibold text-emerald-400"
                      : "font-semibold text-[color:var(--error,#dc2626)]"
                  }
                >
                  ${summary.total_gain_loss.toFixed(2)}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              Asset Allocation
            </h4>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData.length ? chartData : [{ name: "None", value: 1 }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {(chartData.length ? chartData : [{ name: "None", value: 1 }]).map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            chartData.length
                              ? COLORS[index % COLORS.length]
                              : "#d1d5db"
                          }
                        />
                      )
                    )}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
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
          <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
            Portfolio Entries
          </h4>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)]">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Symbol</th>
                    <th className="px-4 py-2 text-left font-semibold">Quantity</th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Purchase Price
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Current Value
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Gain/Loss
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-color,#d1d5db)]">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="text-[color:var(--text-color,#111827)]">
                      <td className="px-4 py-2">{entry.asset_type}</td>
                      <td className="px-4 py-2">{entry.symbol}</td>
                      <td className="px-4 py-2">{entry.quantity}</td>
                      <td className="px-4 py-2">
                        ${Number(entry.purchase_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        ${entry.current_value?.toFixed(2) || "0.00"}
                      </td>
                      <td
                        className={[
                          "px-4 py-2 font-semibold",
                          entry.gain_loss >= 0
                            ? "text-emerald-400"
                            : "text-[color:var(--error,#dc2626)]",
                        ].join(" ")}
                      >
                        ${entry.gain_loss?.toFixed(2) || "0.00"} (
                        {entry.gain_loss_percentage?.toFixed(2) || "0.00"}%)
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
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
        </div>
      </div>
    </section>
  );
}

export default PortfolioAnalyzer;
