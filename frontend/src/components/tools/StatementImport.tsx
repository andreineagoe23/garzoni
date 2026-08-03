import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import UpsellModal from "components/billing/UpsellModal";
import apiClient from "services/httpClient";
import { recordToolEvent } from "services/toolsAnalytics";
import { formatCurrency, getLocale } from "utils/format";

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:statement-import";
const MAX_CLIENT_BYTES = 10 * 1024 * 1024;

// Barclays and most UK high-street banks only offer PDF beyond the last few
// months, so PDF has to be first-class here, not a fallback.
const ACCEPTED_FILE_TYPES = [
  ".csv",
  ".tsv",
  ".txt",
  ".pdf",
  ".xlsx",
  ".ofx",
  ".qfx",
  ".qif",
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

/** Steps shown while the server parses. PDF parsing dominates the wait. */
const ANALYSING_STEPS = ["reading", "categorising", "summarising"] as const;

type Allowance = {
  plan: string;
  is_paid: boolean;
  max_rows: number;
  max_file_bytes: number;
  free_saves_total: number;
  free_saves_used: number;
  free_saves_remaining: number | null;
  can_save: boolean;
};

type CategoryRow = {
  category: string;
  label: string;
  spent: number;
  count: number;
  share: number;
};

type Insight = {
  kind: string;
  tone: "positive" | "neutral" | "warning";
  title: string;
  detail: string;
};

type Analysis = {
  currency: string;
  period_start: string;
  period_end: string;
  days_covered: number;
  transaction_count: number;
  totals: { income: number; spent: number; net: number };
  categories: CategoryRow[];
  top_merchants: Array<{
    merchant: string;
    category_label: string;
    spent: number;
    count: number;
  }>;
  largest_transactions: Array<{
    date: string;
    merchant: string;
    amount: number;
    category_label: string;
  }>;
  recurring: Array<{
    merchant: string;
    category_label: string;
    occurrences: number;
    typical_amount: number;
    total: number;
  }>;
  monthly: Array<{ month: string; income: number; spent: number; net: number }>;
  daily: Array<{ date: string; spent: number }>;
  rhythm: {
    weekday_spent?: number;
    weekend_spent?: number;
    weekend_share?: number;
    no_spend_days?: number;
    average_transaction?: number;
  };
  essentials: {
    essential?: number;
    discretionary?: number;
    discretionary_share?: number;
  };
  insights: Insight[];
};

type Preview = {
  filename: string;
  bank: { slug: string; label: string };
  currency: string;
  row_count: number;
  skipped_rows: number;
  warnings: string[];
  sample: Array<{
    date: string;
    merchant: string;
    description: string;
    amount: number;
    currency: string;
    category_label: string;
  }>;
  analysis: Analysis;
  allowance: Allowance;
};

type ApiError = {
  response?: {
    status?: number;
    data?: { message?: string; allowance?: Allowance };
  };
};

type SavedImport = {
  id: number;
  filename: string;
  dialect_label: string;
  period_start: string | null;
  period_end: string | null;
  created_count: number;
  status: string;
  created_at: string;
};

const TONE_CLASSES: Record<Insight["tone"], string> = {
  positive:
    "border-[color:var(--color-brand-primary)]/30 bg-[color:var(--color-brand-primary)]/10",
  neutral: "border-[color:var(--color-border-default)]",
  warning:
    "border-[color:var(--color-state-error)]/40 bg-[color:var(--color-state-error)]/10",
};

const StatementImport = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // The parsed file is never cached server-side, so we hold the File itself
  // and re-send it if the user chooses to save.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [history, setHistory] = useState<SavedImport[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [analysingStep, setAnalysingStep] = useState(0);
  const [aiBullets, setAiBullets] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);

  // A PDF takes noticeably longer than a CSV, so the wait needs to say what is
  // happening rather than showing an unlabelled spinner.
  useEffect(() => {
    if (!analyzing) {
      setAnalysingStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setAnalysingStep((step) =>
        Math.min(step + 1, ANALYSING_STEPS.length - 1)
      );
    }, 1400);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  const loadMeta = useCallback(async () => {
    try {
      const [allowanceRes, historyRes] = await Promise.allSettled([
        apiClient.get("/budgeting/statements/allowance/"),
        apiClient.get("/budgeting/statements/"),
      ]);
      if (allowanceRes.status === "fulfilled") {
        setAllowance(allowanceRes.value.data?.allowance ?? null);
      }
      if (historyRes.status === "fulfilled") {
        const data = historyRes.value.data;
        setHistory(data?.results ?? data ?? []);
      }
    } catch (_) {
      // Metadata is decorative — the upload flow still works without it.
    }
  }, []);

  useEffect(() => {
    void loadMeta();
    recordToolEvent("tool_open", "statement-import");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify({ label: t("tools.statementImport.activityLabel") })
      );
    }
  }, [loadMeta, t]);

  const currency = preview?.currency || preview?.analysis?.currency || "GBP";

  const dateRange = useCallback(
    (start: string | null, end: string | null) => {
      if (!start || !end) return "";
      const from = new Date(start);
      const to = new Date(end);
      const sameYear = from.getFullYear() === to.getFullYear();
      const fmt = (d: Date, withYear: boolean) =>
        d.toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
          ...(withYear ? { year: "numeric" } : {}),
        });
      return `${fmt(from, !sameYear)} – ${fmt(to, true)}`;
    },
    [locale]
  );

  const money = useCallback(
    (value: number) =>
      formatCurrency(value, currency || "GBP", locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [currency, locale]
  );

  const resolveError = useCallback(
    (err: ApiError) => {
      const data = err?.response?.data;
      if (data?.message) return data.message;
      if (err?.response?.status === 413)
        return t("tools.statementImport.errors.tooLarge");
      if (err?.response?.status === 429)
        return t("tools.statementImport.errors.throttled");
      return t("tools.statementImport.errors.parseFailed");
    },
    [t]
  );

  // Runs after the analysis lands, not inside it: the upload stays fast and
  // an AI outage just leaves the deterministic insights in place.
  const requestInsight = useCallback(async (analysis?: Analysis) => {
    if (!analysis) return;
    setAiBullets(null);
    setAiLoading(true);
    try {
      const res = await apiClient.post("/budgeting/statements/insight/", {
        currency: analysis.currency,
        days_covered: analysis.days_covered,
        totals: analysis.totals,
        categories: analysis.categories.map((row) => ({
          category: row.category,
          spent: row.spent,
          share: row.share,
        })),
        essentials: analysis.essentials,
        rhythm: analysis.rhythm,
        recurring_count: analysis.recurring.length,
        recurring_total: analysis.recurring.reduce(
          (sum, row) => sum + row.typical_amount,
          0
        ),
      });
      setAiBullets(res.data?.available ? (res.data.bullets ?? []) : []);
    } catch (_) {
      setAiBullets([]);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(
    async (selected: File) => {
      if (selected.size > MAX_CLIENT_BYTES) {
        setError(t("tools.statementImport.errors.tooLarge"));
        return;
      }
      setAnalyzing(true);
      setError(null);
      setSaved(null);
      setPreview(null);
      try {
        const body = new FormData();
        body.append("file", selected);
        const res = await apiClient.post(
          "/budgeting/statements/preview/",
          body,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        setPreview(res.data);
        setAllowance(res.data?.allowance ?? null);
        setFile(selected);
        void requestInsight(res.data?.analysis);
        recordToolEvent("statement_analyzed", "statement-import", {
          bank: res.data?.bank?.slug,
          rows: res.data?.row_count,
        });
      } catch (err) {
        setError(resolveError(err as ApiError));
        setFile(null);
      } finally {
        setAnalyzing(false);
      }
    },
    [requestInsight, resolveError, t]
  );

  const handleSave = useCallback(async () => {
    if (!file) return;
    if (allowance && !allowance.can_save) {
      setUpsellOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiClient.post("/budgeting/statements/commit/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSaved(res.data?.import ?? null);
      setAllowance(res.data?.allowance ?? null);
      recordToolEvent("statement_saved", "statement-import", {
        created: res.data?.import?.created_count,
      });
      await loadMeta();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError?.response?.status === 402) {
        setAllowance(apiError.response.data?.allowance ?? allowance);
        setUpsellOpen(true);
      } else {
        setError(resolveError(apiError));
      }
    } finally {
      setSaving(false);
    }
  }, [allowance, file, loadMeta, resolveError]);

  /** Open a previously saved import. The file is long gone, so the server
      re-derives the analysis from the stored transactions. */
  const openSavedImport = useCallback(
    async (row: SavedImport) => {
      setOpeningId(row.id);
      setError(null);
      try {
        const res = await apiClient.get(
          `/budgeting/statements/${row.id}/analysis/`
        );
        setPreview({
          filename: row.filename || row.dialect_label,
          bank: { slug: "", label: row.dialect_label },
          currency: res.data?.analysis?.currency ?? "",
          row_count: row.created_count,
          skipped_rows: 0,
          warnings: [],
          sample: res.data?.sample ?? [],
          analysis: res.data.analysis,
          allowance: allowance as Allowance,
        });
        setSaved(row);
        setFile(null);
        void requestInsight(res.data?.analysis);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (_) {
        setError(t("tools.statementImport.errors.openFailed"));
      } finally {
        setOpeningId(null);
      }
    },
    [allowance, requestInsight, t]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await apiClient.delete(`/budgeting/statements/${id}/`);
        await loadMeta();
        if (saved?.id === id) setSaved(null);
      } catch (err) {
        setError(t("tools.statementImport.errors.deleteFailed"));
      }
    },
    [loadMeta, saved, t]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) void handleAnalyze(dropped);
    },
    [handleAnalyze]
  );

  const analysis = preview?.analysis;
  const maxCategory = useMemo(
    () => Math.max(...(analysis?.categories?.map((c) => c.spent) ?? [0]), 1),
    [analysis]
  );

  const savesLeft = allowance?.is_paid
    ? null
    : (allowance?.free_saves_remaining ?? 0);

  return (
    <section className="space-y-6 min-w-0 w-full">
      {/* One headline, one line of context. The privacy detail is real but
          belongs under the fold, not between the user and the upload. */}
      <header className="max-w-2xl space-y-1">
        <h2 className="app-display text-xl text-content-primary sm:text-2xl">
          {t("tools.statementImport.title")}
        </h2>
        <p className="text-sm text-content-muted">
          {t("tools.statementImport.subtitle")}
        </p>
      </header>

      {analyzing ? (
        <div
          className="app-card app-card--pad-lg flex flex-col items-center gap-4 text-center"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--color-border-default)] border-t-[color:var(--color-brand-primary)]"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-content-primary">
              {t("tools.statementImport.analysing.title")}
            </p>
            <p className="text-xs text-content-muted">
              {t(
                `tools.statementImport.analysing.${ANALYSING_STEPS[analysingStep]}`
              )}
            </p>
          </div>
          <ol className="flex items-center gap-2" aria-hidden="true">
            {ANALYSING_STEPS.map((step, index) => (
              <li
                key={step}
                className={`h-1.5 w-10 rounded-full transition-colors ${
                  index <= analysingStep
                    ? "bg-[color:var(--color-brand-primary)]"
                    : "bg-[color:var(--color-border-default)]"
                }`}
              />
            ))}
          </ol>
          {/* Result-shaped skeleton so the layout does not jump when it lands. */}
          <div className="mt-2 grid w-full gap-3 grid-cols-1 sm:grid-cols-3">
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className="h-16 animate-pulse rounded-2xl bg-[color:var(--color-border-default)]/40"
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`app-card app-card--pad-lg flex flex-col items-center gap-3 border-2 border-dashed text-center transition ${
            dragging
              ? "border-[color:var(--color-brand-primary)]"
              : "border-[color:var(--color-border-default)]"
          }`}
        >
          <span className="text-3xl" aria-hidden="true">
            ⇪
          </span>
          <p className="text-sm font-semibold text-content-primary">
            {t("tools.statementImport.dropzone.title")}
          </p>
          <p className="max-w-md text-xs text-content-muted">
            {t("tools.statementImport.dropzone.hint")}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void handleAnalyze(selected);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="app-cta-btn mt-1 !w-auto !h-auto px-5 py-2 text-sm"
          >
            {t("tools.statementImport.dropzone.choose")}
          </button>
          <p className="text-xs text-content-muted">
            {t("tools.statementImport.dropzone.footnote")}
          </p>
        </div>
      )}

      {error && (
        <div className="app-card app-card--pad-sm border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/10 text-sm text-[color:var(--color-state-error)]">
          {error}
        </div>
      )}

      {analysis && (
        <>
          {(aiLoading || (aiBullets && aiBullets.length > 0)) && (
            <div className="app-card app-card--pad border-[color:var(--color-brand-primary)]/30 bg-[color:var(--color-brand-primary)]/5">
              <p className="text-sm font-semibold text-content-primary">
                {t("tools.statementImport.ai.title")}
              </p>
              {aiLoading ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((slot) => (
                    <div
                      key={slot}
                      className="h-3 animate-pulse rounded-full bg-[color:var(--color-border-default)]/50"
                    />
                  ))}
                </div>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {aiBullets?.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex gap-2 text-sm text-content-primary"
                    >
                      <span
                        aria-hidden="true"
                        className="text-[color:var(--color-brand-primary)]"
                      >
                        •
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-content-muted">
                {t("tools.statementImport.ai.privacy")}
              </p>
            </div>
          )}
          <div className="app-card app-card--pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-content-primary">
                  {t("tools.statementImport.summary.title", {
                    bank: preview?.bank?.label,
                  })}
                </p>
                <p className="text-xs text-content-muted">
                  {t("tools.statementImport.summary.range", {
                    start: analysis.period_start,
                    end: analysis.period_end,
                    count: analysis.transaction_count,
                  })}
                </p>
              </div>
              <span className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1 text-xs text-content-muted">
                {preview?.filename}
              </span>
            </div>

            {preview?.warnings?.length ? (
              <ul className="mt-3 space-y-1">
                {preview.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="rounded-2xl border border-[color:var(--warning,#b45309)]/40 px-3 py-2 text-xs text-[color:var(--warning,#b45309)]"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-3">
              {(
                [
                  ["income", analysis.totals.income],
                  ["spent", analysis.totals.spent],
                  ["net", analysis.totals.net],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="app-card app-card--pad-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                    {t(`tools.statementImport.totals.${key}`)}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-semibold ${
                      key === "net" && value < 0
                        ? "text-[color:var(--color-state-error)]"
                        : "text-content-primary"
                    }`}
                  >
                    {money(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {analysis.insights.length > 0 && (
            <div className="app-card app-card--pad">
              <p className="text-sm font-semibold text-content-primary">
                {t("tools.statementImport.insights.title")}
              </p>
              <ul className="mt-3 space-y-2">
                {analysis.insights.map((insight) => (
                  <li
                    key={`${insight.kind}-${insight.title}`}
                    className={`rounded-2xl border px-3 py-2 ${TONE_CLASSES[insight.tone]}`}
                  >
                    <p className="text-sm font-medium text-content-primary">
                      {insight.title}
                    </p>
                    <p className="text-xs text-content-muted">
                      {insight.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <div className="app-card app-card--pad">
              <p className="text-sm font-semibold text-content-primary">
                {t("tools.statementImport.categories.title")}
              </p>
              <ul className="mt-3 space-y-2">
                {analysis.categories.slice(0, 10).map((row) => (
                  <li key={row.category}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-content-primary">{row.label}</span>
                      <span className="text-xs text-content-muted">
                        {money(row.spent)} · {row.share.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-border-default)]">
                      <div
                        className="h-full bg-[color:var(--color-brand-primary)]"
                        style={{ width: `${(row.spent / maxCategory) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="app-card app-card--pad">
              <p className="text-sm font-semibold text-content-primary">
                {t("tools.statementImport.recurring.title")}
              </p>
              {analysis.recurring.length === 0 ? (
                <p className="mt-3 text-xs text-content-muted">
                  {t("tools.statementImport.recurring.empty")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {analysis.recurring.map((row) => (
                    <li
                      key={row.merchant}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--color-border-default)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-content-primary">
                          {row.merchant}
                        </p>
                        <p className="text-xs text-content-muted">
                          {t("tools.statementImport.recurring.meta", {
                            count: row.occurrences,
                            category: row.category_label,
                          })}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-content-muted">
                        {money(row.typical_amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="app-card app-card--pad">
              <p className="text-sm font-semibold text-content-primary">
                {t("tools.statementImport.merchants.title")}
              </p>
              <ul className="mt-3 space-y-2">
                {analysis.top_merchants.map((row) => (
                  <li
                    key={row.merchant}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-content-primary">
                      {row.merchant}
                    </span>
                    <span className="whitespace-nowrap text-xs text-content-muted">
                      {money(row.spent)} · {row.count}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="app-card app-card--pad">
              <p className="text-sm font-semibold text-content-primary">
                {t("tools.statementImport.sample.title")}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="text-content-muted">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">
                        {t("tools.statementImport.sample.date")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("tools.statementImport.sample.merchant")}
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {t("tools.statementImport.sample.category")}
                      </th>
                      <th className="pb-2 text-right font-medium">
                        {t("tools.statementImport.sample.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview?.sample?.map((row, index) => (
                      <tr
                        key={`${row.date}-${row.description}-${index}`}
                        className="border-t border-[color:var(--color-border-default)]"
                      >
                        <td className="py-1.5 pr-3 text-content-muted">
                          {row.date}
                        </td>
                        <td className="py-1.5 pr-3 text-content-primary">
                          {row.merchant || row.description}
                        </td>
                        <td className="py-1.5 pr-3 text-content-muted">
                          {row.category_label}
                        </td>
                        <td
                          className={`py-1.5 text-right ${
                            row.amount < 0
                              ? "text-content-primary"
                              : "text-[color:var(--color-brand-primary)]"
                          }`}
                        >
                          {money(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="app-card app-card--pad">
            {saved ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-content-primary">
                    {t("tools.statementImport.save.done", {
                      count: saved.created_count,
                    })}
                  </p>
                  <p className="text-xs text-content-muted">
                    {t("tools.statementImport.save.doneHint")}
                  </p>
                </div>
                <a
                  href="/tools/budget-planner"
                  className="app-cta-btn !w-auto !h-auto px-5 py-2 text-sm"
                >
                  {t("tools.statementImport.save.openPlanner")}
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="max-w-xl">
                  <p className="text-sm font-semibold text-content-primary">
                    {t("tools.statementImport.save.title")}
                  </p>
                  <p className="text-xs text-content-muted">
                    {allowance?.is_paid
                      ? t("tools.statementImport.save.hintPaid")
                      : savesLeft && savesLeft > 0
                        ? t("tools.statementImport.save.hintFree", {
                            count: savesLeft,
                          })
                        : t("tools.statementImport.save.hintLocked")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="app-cta-btn !w-auto !h-auto px-5 py-2 text-sm disabled:opacity-60"
                >
                  {saving
                    ? t("tools.statementImport.save.saving")
                    : allowance?.can_save === false
                      ? t("tools.statementImport.save.upgrade")
                      : t("tools.statementImport.save.cta")}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="app-card app-card--pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-content-primary">
            {t("tools.statementImport.history.titleWithCount", {
              count: history.length,
            })}
          </p>
          {allowance && !allowance.is_paid && !allowance.can_save && (
            <span className="text-xs text-content-muted">
              {t("tools.statementImport.history.freeUsed")}
            </span>
          )}
        </div>
        {history.length === 0 && (
          <p className="mt-2 text-xs text-content-muted">
            {t("tools.statementImport.history.empty")}
          </p>
        )}
        {history.length > 0 && (
          <div>
            <ul className="mt-3 space-y-2">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--color-border-default)] px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => openSavedImport(row)}
                    disabled={openingId === row.id}
                    className="min-w-0 flex-1 text-left transition hover:opacity-80 disabled:opacity-60"
                  >
                    <p className="truncate text-sm font-medium text-content-primary">
                      {row.filename || row.dialect_label}
                    </p>
                    <p className="text-xs text-content-muted">
                      {openingId === row.id
                        ? t("tools.statementImport.analysing.title")
                        : t("tools.statementImport.history.meta", {
                            count: row.created_count,
                            range: dateRange(row.period_start, row.period_end),
                          })}
                    </p>
                  </button>
                  {row.status === "completed" ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="text-xs font-semibold text-[color:var(--color-state-error)] hover:underline"
                    >
                      {t("tools.statementImport.history.undo")}
                    </button>
                  ) : (
                    <span className="text-xs text-content-muted">
                      {t("tools.statementImport.history.reverted")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-xs text-content-muted">
        {t("tools.statementImport.privacyNote")}
      </p>

      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </section>
  );
};

export default StatementImport;
