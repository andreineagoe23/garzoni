import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import { recordToolEvent } from "services/toolsAnalytics";
import { formatCurrency, getLocale } from "utils/format";

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:budget-planner";

type LinkedAccount = {
  id: number;
  provider: string;
  display_name: string;
  status: string;
  last_synced_at: string | null;
};

type Envelope = {
  id: number;
  category: string;
  label: string;
  monthly_target: number;
  spent_this_period: number;
  currency: string;
};

type SpendingSummary = {
  period: string;
  total_income: number;
  total_spent: number;
  net_cash_flow: number;
  currency: string;
  by_category: Array<{
    category: string;
    label: string;
    spent: number;
    target: number | null;
    over_budget: boolean;
  }>;
};

type ProviderStatus = {
  enabled: boolean;
  provider: string | null;
  region: string | null;
  ready: boolean;
};

const CATEGORY_PRESETS = [
  "housing",
  "groceries",
  "transport",
  "utilities",
  "entertainment",
  "savings",
  "other",
];

const BudgetPlanner = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEnvelope, setNewEnvelope] = useState({
    category: "groceries",
    label: "",
    monthly_target: "",
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, envRes, sumRes, statusRes] = await Promise.allSettled([
        apiClient.get("/budgeting/linked-accounts/"),
        apiClient.get("/budgeting/envelopes/"),
        apiClient.get("/budgeting/spending-summary/"),
        apiClient.get("/budgeting/provider-status/"),
      ]);
      if (accRes.status === "fulfilled") {
        setAccounts(accRes.value.data?.results ?? accRes.value.data ?? []);
      }
      if (envRes.status === "fulfilled") {
        setEnvelopes(envRes.value.data?.results ?? envRes.value.data ?? []);
      }
      if (sumRes.status === "fulfilled") {
        setSummary(sumRes.value.data ?? null);
      }
      if (statusRes.status === "fulfilled") {
        setProviderStatus(statusRes.value.data ?? null);
      }
      const anyAuthError = [accRes, envRes, sumRes].some(
        (r) =>
          r.status === "rejected" &&
          (r.reason?.response?.status === 402 ||
            r.reason?.response?.status === 403)
      );
      if (anyAuthError) {
        setError(t("tools.budgetPlanner.errors.notEntitled"));
      }
    } catch (err) {
      setError(t("tools.budgetPlanner.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchAll();
    recordToolEvent("tool_open", "budget-planner");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify({ label: t("tools.budgetPlanner.activityLabel") })
      );
    }
  }, [fetchAll, t]);

  const currency = summary?.currency || envelopes[0]?.currency || "USD";

  const handleCreateEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvelope.label || !newEnvelope.monthly_target) return;
    setCreating(true);
    try {
      await apiClient.post("/budgeting/envelopes/", {
        category: newEnvelope.category,
        label: newEnvelope.label,
        monthly_target: Number(newEnvelope.monthly_target),
      });
      setNewEnvelope({ category: "groceries", label: "", monthly_target: "" });
      await fetchAll();
      recordToolEvent("budget_envelope_created", "budget-planner", {
        category: newEnvelope.category,
      });
    } catch (err) {
      setError(t("tools.budgetPlanner.errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleStartLink = async () => {
    try {
      const res = await apiClient.post("/budgeting/provider/link-token/", {});
      const url = res.data?.connect_url as string | undefined;
      if (url) {
        window.location.href = url;
      } else {
        setError(t("tools.budgetPlanner.errors.linkUnavailable"));
      }
    } catch (err) {
      setError(t("tools.budgetPlanner.errors.linkUnavailable"));
    }
  };

  const overBudgetCount = useMemo(() => {
    if (!summary?.by_category) return 0;
    return summary.by_category.filter((c) => c.over_budget).length;
  }, [summary]);

  return (
    <section className="space-y-6 min-w-0 w-full">
      <header className="app-card px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.budgetPlanner.eyebrow")}
            </p>
            <h2 className="app-display text-xl text-content-primary sm:text-2xl">
              {t("tools.budgetPlanner.title")}
            </h2>
            <p className="text-sm text-content-muted">
              {t("tools.budgetPlanner.subtitle")}
            </p>
          </div>
          {providerStatus && providerStatus.enabled && (
            <button
              type="button"
              onClick={handleStartLink}
              className="rounded-full bg-[color:var(--color-brand-primary)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[color:var(--color-brand-primary-hover)]"
            >
              {accounts.length > 0
                ? t("tools.budgetPlanner.relinkAccount")
                : t("tools.budgetPlanner.linkAccount")}
            </button>
          )}
        </div>
        {providerStatus && !providerStatus.enabled && (
          <p className="mt-3 rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] px-3 py-2 text-xs text-content-muted">
            {t("tools.budgetPlanner.providerUnavailable")}
          </p>
        )}
      </header>

      {error && (
        <div className="app-card border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/10 px-4 py-3 text-sm text-[color:var(--color-state-error)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="app-card px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            {t("tools.budgetPlanner.totals.income")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-content-primary">
            {loading
              ? "—"
              : formatCurrency(summary?.total_income ?? 0, currency, locale, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
          </p>
        </div>
        <div className="app-card px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            {t("tools.budgetPlanner.totals.spent")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-content-primary">
            {loading
              ? "—"
              : formatCurrency(summary?.total_spent ?? 0, currency, locale, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
          </p>
        </div>
        <div className="app-card px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            {t("tools.budgetPlanner.totals.netFlow")}
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              (summary?.net_cash_flow ?? 0) >= 0
                ? "text-[color:var(--color-brand-primary)]"
                : "text-[color:var(--color-state-error)]"
            }`}
          >
            {loading
              ? "—"
              : formatCurrency(summary?.net_cash_flow ?? 0, currency, locale, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
          </p>
          {overBudgetCount > 0 && (
            <p className="mt-1 text-xs text-[color:var(--warning,#b45309)]">
              {t("tools.budgetPlanner.totals.overBudgetCount", {
                count: overBudgetCount,
              })}
            </p>
          )}
        </div>
      </div>

      <div className="app-card px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-content-primary">
            {t("tools.budgetPlanner.envelopes.title")}
          </p>
          <p className="text-xs text-content-muted">
            {t("tools.budgetPlanner.envelopes.subtitle")}
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          {envelopes.length === 0 && !loading && (
            <li className="rounded-2xl border border-dashed border-[color:var(--color-border-default)] px-4 py-4 text-center text-xs text-content-muted">
              {t("tools.budgetPlanner.envelopes.empty")}
            </li>
          )}
          {envelopes.map((env) => {
            const ratio =
              env.monthly_target > 0
                ? Math.min(env.spent_this_period / env.monthly_target, 2)
                : 0;
            const percent = Math.round(ratio * 100);
            const over = env.spent_this_period > env.monthly_target;
            return (
              <li
                key={env.id}
                className="rounded-2xl border border-[color:var(--color-border-default)] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-content-primary">
                    {env.label}
                  </span>
                  <span
                    className={`text-xs ${
                      over
                        ? "text-[color:var(--color-state-error)]"
                        : "text-content-muted"
                    }`}
                  >
                    {formatCurrency(
                      env.spent_this_period,
                      env.currency,
                      locale,
                      {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }
                    )}{" "}
                    /{" "}
                    {formatCurrency(env.monthly_target, env.currency, locale, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-border-default)]">
                  <div
                    className={`h-full transition-all ${
                      over
                        ? "bg-[color:var(--color-state-error)]"
                        : "bg-[color:var(--color-brand-primary)]"
                    }`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <form
          onSubmit={handleCreateEnvelope}
          className="mt-4 grid gap-2 grid-cols-1 sm:grid-cols-4"
        >
          <select
            value={newEnvelope.category}
            onChange={(e) =>
              setNewEnvelope((p) => ({ ...p, category: e.target.value }))
            }
            className="rounded-full border border-[color:var(--color-border-default)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-content-primary"
          >
            {CATEGORY_PRESETS.map((cat) => (
              <option key={cat} value={cat}>
                {t(`tools.budgetPlanner.categories.${cat}`, cat)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newEnvelope.label}
            placeholder={t("tools.budgetPlanner.envelopes.labelPlaceholder")}
            onChange={(e) =>
              setNewEnvelope((p) => ({ ...p, label: e.target.value }))
            }
            className="rounded-full border border-[color:var(--color-border-default)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-content-primary"
          />
          <input
            type="number"
            value={newEnvelope.monthly_target}
            placeholder={t("tools.budgetPlanner.envelopes.targetPlaceholder")}
            onChange={(e) =>
              setNewEnvelope((p) => ({ ...p, monthly_target: e.target.value }))
            }
            min="0"
            step="10"
            className="rounded-full border border-[color:var(--color-border-default)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-content-primary"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-[color:var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[color:var(--color-brand-primary-hover)] disabled:opacity-60"
          >
            {creating
              ? t("tools.budgetPlanner.envelopes.adding")
              : t("tools.budgetPlanner.envelopes.add")}
          </button>
        </form>
      </div>

      {summary?.by_category && summary.by_category.length > 0 && (
        <div className="app-card px-5 py-5 sm:px-6">
          <p className="text-sm font-semibold text-content-primary">
            {t("tools.budgetPlanner.byCategory.title")}
          </p>
          <ul className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
            {summary.by_category.map((row) => (
              <li
                key={row.category}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm ${
                  row.over_budget
                    ? "border-[color:var(--color-state-error)]/40 text-[color:var(--color-state-error)]"
                    : "border-[color:var(--color-border-default)] text-content-primary"
                }`}
              >
                <span>{row.label}</span>
                <span className="text-xs">
                  {formatCurrency(row.spent, currency, locale, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default BudgetPlanner;
