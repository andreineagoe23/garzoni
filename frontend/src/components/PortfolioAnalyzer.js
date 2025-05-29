import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Form, Button, Table, Alert, Spinner } from "react-bootstrap";

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

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

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

      // Fetch current prices for each entry
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

      // Calculate new summary
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
    // Set up interval to refresh prices every 5 minutes
    const interval = setInterval(fetchPortfolio, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEntry((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  const renderPieChart = () => {
    if (!summary?.allocation) return null;

    const data = Object.entries(summary.allocation).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(value),
    }));

    return (
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="portfolio-analyzer">
      <h2 className="mb-4">Portfolio Analyzer</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      {summary && (
        <div className="portfolio-summary mb-4">
          <div className="row">
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="card-title">Portfolio Summary</h5>
                  <p className="mb-1">
                    Total Value: ${summary.total_value.toFixed(2)}
                  </p>
                  <p className="mb-1">
                    Total Gain/Loss:
                    <span
                      className={
                        summary.total_gain_loss >= 0
                          ? "text-success"
                          : "text-danger"
                      }
                    >
                      ${summary.total_gain_loss.toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Asset Allocation</h5>
                  {renderPieChart()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Add New Entry</h5>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Asset Type</Form.Label>
                  <Form.Select
                    name="asset_type"
                    value={newEntry.asset_type}
                    onChange={handleInputChange}
                  >
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Symbol</Form.Label>
                  <Form.Control
                    type="text"
                    name="symbol"
                    value={newEntry.symbol}
                    onChange={handleInputChange}
                    placeholder="e.g., AAPL, BTC"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control
                    type="number"
                    name="quantity"
                    value={newEntry.quantity}
                    onChange={handleInputChange}
                    step="any"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Purchase Price</Form.Label>
                  <Form.Control
                    type="number"
                    name="purchase_price"
                    value={newEntry.purchase_price}
                    onChange={handleInputChange}
                    step="any"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Purchase Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="purchase_date"
                    value={newEntry.purchase_date}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>

                <Button variant="primary" type="submit">
                  Add Entry
                </Button>
              </Form>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Portfolio Entries</h5>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Symbol</th>
                      <th>Quantity</th>
                      <th>Purchase Price</th>
                      <th>Current Value</th>
                      <th>Gain/Loss</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.asset_type}</td>
                        <td>{entry.symbol}</td>
                        <td>{entry.quantity}</td>
                        <td>${entry.purchase_price}</td>
                        <td>${entry.current_value.toFixed(2)}</td>
                        <td
                          className={
                            entry.gain_loss >= 0
                              ? "text-success"
                              : "text-danger"
                          }
                        >
                          ${entry.gain_loss.toFixed(2)} (
                          {entry.gain_loss_percentage.toFixed(2)}%)
                        </td>
                        <td>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(entry.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortfolioAnalyzer;
