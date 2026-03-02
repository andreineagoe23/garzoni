import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "contexts/AuthContext";
import apiClient from "services/httpClient";
import { formatCurrency, getLocale } from "utils/format";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:savings";

const SavingsGoalCalculator = () => {
  const { t } = useTranslation();
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
  const locale = getLocale();
  const presets = useMemo(
    () => [
      {
        label: t("tools.savingsCalc.starterGoal"),
        values: {
          savings_goal: "10000",
          initial_investment: "1000",
          years_to_grow: "2",
          annual_interest_rate: "5",
          compound_frequency: "12",
        },
      },
      {
        label: t("tools.savingsCalc.longTerm"),
        values: {
          savings_goal: "50000",
          initial_investment: "5000",
          years_to_grow: "10",
          annual_interest_rate: "6",
          compound_frequency: "12",
        },
      },
    ],
    [t]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const values = Object.values(formData);
    if (values.some((value) => value === "")) {
      setError(t("tools.savingsCalc.allFieldsRequired"));
      return false;
    }
    if (Number(formData.annual_interest_rate) > 30) {
      setError(t("tools.savingsCalc.interestRateMax"));
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
      const response = await apiClient.post(
        "/calculate-savings-goal/",
        formData
      );
      setResult(response.data);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          ACTIVITY_STORAGE_KEY,
          JSON.stringify({
            label: `${t("tools.savingsCalc.activityPrefix")} ${formatCurrency(
              Number(formData.savings_goal || 0),
              "USD",
              locale,
              { minimumFractionDigits: 0, maximumFractionDigits: 0 }
            )}`,
          })
        );
      }
      if (typeof window.gtag === "function") {
        window.gtag("event", "savings_calc_submitted", {
          tool_id: "savings",
        });
      }
    } catch (err) {
      console.error("Calculation error:", err);
      const apiMessage =
        err.response?.data?.message || err.response?.data?.error;
      setError(apiMessage || t("tools.savingsCalc.calculationFailed"));
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {t("tools.savingsCalc.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("tools.savingsCalc.subtitle")}
        </p>
      </header>

      <div
        className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            {t("tools.savingsCalc.demoPresets")}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setFormData(preset.values)}
                className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
            <li>• {t("tools.savingsCalc.presetTip1")}</li>
            <li>• {t("tools.savingsCalc.presetTip2")}</li>
            <li>• {t("tools.savingsCalc.presetTip3")}</li>
          </ul>
        </div>
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2"
          noValidate
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.savingsCalc.savingsGoal")}
            <input
              type="number"
              name="savings_goal"
              placeholder={t("tools.savingsCalc.savingsGoalPlaceholder")}
              value={formData.savings_goal}
              onChange={handleChange}
              required
              min="0"
              step="100"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.savingsCalc.initialInvestment")}
            <input
              type="number"
              name="initial_investment"
              placeholder={t("tools.savingsCalc.initialInvestmentPlaceholder")}
              value={formData.initial_investment}
              onChange={handleChange}
              required
              min="0"
              step="100"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.savingsCalc.yearsToGrow")}
            <input
              type="number"
              name="years_to_grow"
              placeholder={t("tools.savingsCalc.yearsToGrowPlaceholder")}
              value={formData.years_to_grow}
              onChange={handleChange}
              required
              min="1"
              max="50"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.savingsCalc.annualInterestRate")}
            <input
              type="number"
              name="annual_interest_rate"
              placeholder={t("tools.savingsCalc.annualInterestRatePlaceholder")}
              value={formData.annual_interest_rate}
              onChange={handleChange}
              required
              min="0"
              max="30"
              step="0.1"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)] md:col-span-2">
            {t("tools.savingsCalc.compoundFrequency")}
            <select
              name="compound_frequency"
              value={formData.compound_frequency}
              onChange={handleChange}
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              <option value="1">{t("tools.savingsCalc.annually")}</option>
              <option value="4">{t("tools.savingsCalc.quarterly")}</option>
              <option value="12">{t("tools.savingsCalc.monthly")}</option>
              <option value="365">{t("tools.savingsCalc.daily")}</option>
            </select>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              {t("tools.savingsCalc.calculate")}
            </button>
          </div>
        </form>

        {result && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 shadow-inner shadow-emerald-500/20">
            <p>
              {t("tools.savingsCalc.finalSavings")}:{" "}
              <span className="font-semibold">
                {formatCurrency(
                  Number(result.final_savings || 0),
                  "USD",
                  locale,
                  { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                )}
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
