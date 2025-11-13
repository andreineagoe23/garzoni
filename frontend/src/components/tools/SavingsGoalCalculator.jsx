import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";

const SavingsGoalCalculator = () => {
  const [formData, setFormData] = useState({
    savings_goal: "",
    initial_investment: "",
    years_to_grow: "",
    annual_interest_rate: "",
    compound_frequency: "1",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { getAccessToken } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const values = Object.values(formData);
    if (values.some((value) => value === "")) {
      setError("Please fill all required fields.");
      return false;
    }
    if (Number(formData.annual_interest_rate) > 30) {
      setError("Interest rate cannot exceed 30%.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setResult(null);
    setError(null);

    if (!validateForm()) return;

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/calculate-savings-goal/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setResult(response.data);
    } catch (err) {
      console.error("Calculation error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to calculate. Please check your inputs."
      );
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Savings Goal Calculator
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Estimate how long it will take to reach your savings goal based on
          compound interest.
        </p>
      </header>

      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-white px-6 py-6 shadow-xl shadow-black/5">
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2"
          noValidate
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Savings Goal ($)
            <input
              type="number"
              name="savings_goal"
              placeholder="Desired final savings"
              value={formData.savings_goal}
              onChange={handleChange}
              required
              min="0"
              step="100"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Initial Investment ($)
            <input
              type="number"
              name="initial_investment"
              placeholder="Amount readily available"
              value={formData.initial_investment}
              onChange={handleChange}
              required
              min="0"
              step="100"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Years to Grow
            <input
              type="number"
              name="years_to_grow"
              placeholder="Length of time in years"
              value={formData.years_to_grow}
              onChange={handleChange}
              required
              min="1"
              max="50"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Annual Interest Rate (%)
            <input
              type="number"
              name="annual_interest_rate"
              placeholder="Enter percentage"
              value={formData.annual_interest_rate}
              onChange={handleChange}
              required
              min="0"
              max="30"
              step="0.1"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)] md:col-span-2">
            Compound Frequency
            <select
              name="compound_frequency"
              value={formData.compound_frequency}
              onChange={handleChange}
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              <option value="1">Annually</option>
              <option value="4">Quarterly</option>
              <option value="12">Monthly</option>
              <option value="365">Daily</option>
            </select>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              Calculate
            </button>
          </div>
        </form>

        {result && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 shadow-inner shadow-emerald-500/20">
            <p>
              Projected Value:{" "}
              <span className="font-semibold">
                ${result.final_savings?.toLocaleString()}
              </span>
            </p>
            {result.message && <p>{result.message}</p>}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
            {error}
          </div>
        )}
      </div>
    </section>
  );
};

export default SavingsGoalCalculator;

