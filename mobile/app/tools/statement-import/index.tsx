import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiClient } from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { layout, radius, spacing, typography } from "../../../src/theme/tokens";
import { useScreenGutter } from "../../../src/utils/platform";
import { href } from "../../../src/navigation/href";
import { logDevError } from "../../../src/lib/logDevError";
import { trackGarzoniEvent } from "../../../src/bootstrap/customerIoMobile";
import PlusBottomSheet from "../../../src/components/tools/PlusBottomSheet";

/**
 * CSV statement import.
 *
 * Analysis is free on every plan — that is the point of the screen. Only
 * *saving* the import consumes the free allowance and then needs Plus, so this
 * screen deliberately does not gate itself behind an entitlement check the way
 * the other budgeting tools do.
 */

// Barclays and most UK high-street banks only offer PDF beyond the last few
// months, so PDF is first-class here, not a fallback.
const ALLOWED_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".txt",
  ".pdf",
  ".xlsx",
  ".ofx",
  ".qfx",
  ".qif",
];

/** Steps shown while the server parses. PDF parsing dominates the wait. */
const ANALYSING_STEPS = ["reading", "categorising", "summarising"] as const;

/**
 * `expo-document-picker` is a native module. A binary built before it was added
 * — any current dev client, and every already-installed store build — does not
 * contain it, and a top-level `import` of it throws while the module is being
 * evaluated. That kills the whole route: expo-router then reports the screen as
 * "missing the required default export" and the tool is unreachable.
 *
 * Loading it lazily keeps the screen alive on those builds, where the paste
 * fallback below takes over until the user updates.
 */
type DocumentPickerModule = typeof import("expo-document-picker");

function loadDocumentPicker(): DocumentPickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-document-picker") as DocumentPickerModule;
  } catch {
    return null;
  }
}

const DocumentPicker = loadDocumentPicker();

// Bank exports come back with wildly inconsistent MIME types depending on the
// Android storage provider (Drive, Files, Downloads), so the picker accepts a
// broad set and the extension check below is what actually validates.
const PICKER_MIME_TYPES = [
  "text/csv",
  "text/comma-separated-values",
  "text/plain",
  "text/tab-separated-values",
  "application/csv",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/x-ofx",
  "application/vnd.intu.qfx",
  "application/octet-stream",
];

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

type Insight = {
  kind: string;
  tone: "positive" | "neutral" | "warning";
  title: string;
  detail: string;
};

type CategoryRow = {
  category: string;
  label: string;
  spent: number;
  share: number;
};

type Analysis = {
  currency: string;
  period_start: string;
  period_end: string;
  days_covered: number;
  transaction_count: number;
  totals: { income: number; spent: number; net: number };
  categories: CategoryRow[];
  top_merchants: { merchant: string; spent: number; count: number }[];
  recurring: {
    merchant: string;
    category_label: string;
    occurrences: number;
    typical_amount: number;
  }[];
  essentials: {
    essential?: number;
    discretionary?: number;
    discretionary_share?: number;
  };
  rhythm: {
    weekend_share?: number;
    no_spend_days?: number;
    average_transaction?: number;
  };
  insights: Insight[];
};

type Preview = {
  filename: string;
  bank: { slug: string; label: string };
  currency: string;
  row_count: number;
  warnings: string[];
  sample: {
    date: string;
    merchant: string;
    description: string;
    amount: number;
    category_label: string;
  }[];
  analysis: Analysis;
  allowance: Allowance;
};

type SavedImport = {
  id: number;
  filename: string;
  dialect_label: string;
  period_start: string | null;
  period_end: string | null;
  created_count: number;
  status: string;
};

/** Where the statement came from. Both end up as the same multipart request. */
type Source =
  | { kind: "file"; uri: string; name: string; mimeType: string }
  | { kind: "text"; text: string };

export default function StatementImportScreen() {
  const c = useThemeColors();
  const gutter = useScreenGutter();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [source, setSource] = useState<Source | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [history, setHistory] = useState<SavedImport[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plusSheetVisible, setPlusSheetVisible] = useState(false);
  const [analysingStep, setAnalysingStep] = useState(0);
  const [aiBullets, setAiBullets] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);

  // A PDF takes noticeably longer than a CSV, so the wait says what is
  // happening rather than showing an unlabelled spinner.
  useEffect(() => {
    if (!analyzing) {
      setAnalysingStep(0);
      return;
    }
    const timer = setInterval(() => {
      setAnalysingStep((step) =>
        Math.min(step + 1, ANALYSING_STEPS.length - 1),
      );
    }, 1400);
    return () => clearInterval(timer);
  }, [analyzing]);

  const loadMeta = useCallback(async () => {
    try {
      const [allowanceRes, historyRes] = await Promise.allSettled([
        (apiClient as any).get("/budgeting/statements/allowance/"),
        (apiClient as any).get("/budgeting/statements/"),
      ]);
      if (allowanceRes.status === "fulfilled") {
        setAllowance(allowanceRes.value.data?.allowance ?? null);
      }
      if (historyRes.status === "fulfilled") {
        const data = historyRes.value.data;
        setHistory(data?.results ?? data ?? []);
      }
    } catch (e) {
      logDevError("tools/statement-import/meta", e);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const currency = preview?.currency || preview?.analysis?.currency || "GBP";

  const dateRange = useCallback((start: string | null, end: string | null) => {
    if (!start || !end) return "";
    const from = new Date(start);
    const to = new Date(end);
    const sameYear = from.getFullYear() === to.getFullYear();
    const fmt = (d: Date, withYear: boolean) =>
      d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
      });
    return `${fmt(from, !sameYear)} – ${fmt(to, true)}`;
  }, []);

  const money = useCallback(
    (value: number) => `${Math.round(value).toLocaleString()} ${currency}`,
    [currency],
  );

  const resolveError = useCallback(
    (err: any) => {
      const status = err?.response?.status;
      if (err?.response?.data?.message) return err.response.data.message;
      if (status === 413) return t("tools.statementImport.errors.tooLarge");
      if (status === 429) return t("tools.statementImport.errors.throttled");
      return t("tools.statementImport.errors.parseFailed");
    },
    [t],
  );

  /**
   * Multipart body for either source. A picked file goes in as the
   * `{uri, name, type}` triple RN expects; pasted CSV goes in as a plain
   * `text` field the backend accepts as an equivalent.
   */
  const buildForm = useCallback((from: Source) => {
    const body = new FormData();
    if (from.kind === "file") {
      body.append("file", {
        uri: from.uri,
        name: from.name,
        type: from.mimeType,
      } as unknown as Blob);
    } else {
      body.append("text", from.text);
      body.append("filename", "pasted.csv");
    }
    return body;
  }, []);

  // Runs after the analysis lands, not inside it: the upload stays fast and
  // an AI outage just leaves the deterministic insights in place.
  const requestInsight = useCallback(async (analysis?: Analysis) => {
    if (!analysis) return;
    setAiBullets(null);
    setAiLoading(true);
    try {
      const res = await (apiClient as any).post(
        "/budgeting/statements/insight/",
        {
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
            0,
          ),
        },
      );
      setAiBullets(res.data?.available ? (res.data.bullets ?? []) : []);
    } catch (e) {
      logDevError("tools/statement-import/insight", e);
      setAiBullets([]);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const analyze = useCallback(
    async (from: Source) => {
      setAnalyzing(true);
      setError(null);
      setSaved(null);
      setPreview(null);
      try {
        const res = await (apiClient as any).post(
          "/budgeting/statements/preview/",
          buildForm(from),
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        setPreview(res.data);
        setAllowance(res.data?.allowance ?? null);
        setSource(from);
        void requestInsight(res.data?.analysis);
        void trackGarzoniEvent("statement_analyzed", {
          bank: res.data?.bank?.slug,
          rows: res.data?.row_count,
          input: from.kind,
          surface: "mobile",
        });
      } catch (e) {
        logDevError("tools/statement-import/preview", e);
        setError(resolveError(e));
        setSource(null);
      } finally {
        setAnalyzing(false);
      }
    },
    [buildForm, requestInsight, resolveError],
  );

  const handlePick = useCallback(async () => {
    if (!DocumentPicker) {
      setPasteOpen(true);
      setError(t("tools.statementImport.errors.pickerUnavailable"));
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: PICKER_MIME_TYPES,
        // Content:// URIs from Android providers are not readable by the
        // upload layer; copying gives us a stable file:// path on both OSes.
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      const name = asset.name || "statement.csv";
      if (!ALLOWED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) {
        setError(t("tools.statementImport.errors.wrongType"));
        return;
      }
      const limit = allowance?.max_file_bytes ?? 1024 * 1024;
      if (asset.size && asset.size > limit) {
        setError(t("tools.statementImport.errors.tooLarge"));
        return;
      }
      await analyze({
        kind: "file",
        uri: asset.uri,
        name,
        mimeType: asset.mimeType || "text/csv",
      });
    } catch (e) {
      logDevError("tools/statement-import/pick", e);
      setError(t("tools.statementImport.errors.parseFailed"));
    }
  }, [allowance, analyze, t]);

  const handleAnalyzePasted = useCallback(() => {
    const text = pastedText.trim();
    if (!text) return;
    void analyze({ kind: "text", text });
  }, [analyze, pastedText]);

  const handleSave = useCallback(async () => {
    if (!source) return;
    if (allowance && !allowance.can_save) {
      setPlusSheetVisible(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await (apiClient as any).post(
        "/budgeting/statements/commit/",
        buildForm(source),
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setSaved(res.data?.import ?? null);
      setAllowance(res.data?.allowance ?? null);
      void trackGarzoniEvent("statement_saved", {
        created: res.data?.import?.created_count,
        surface: "mobile",
      });
      await loadMeta();
    } catch (e: any) {
      if (e?.response?.status === 402) {
        setAllowance(e.response.data?.allowance ?? allowance);
        setPlusSheetVisible(true);
      } else {
        logDevError("tools/statement-import/commit", e);
        setError(resolveError(e));
      }
    } finally {
      setSaving(false);
    }
  }, [allowance, buildForm, source, loadMeta, resolveError]);

  /** Open a previously saved import. The file is long gone, so the server
      re-derives the analysis from the stored transactions. */
  const openSavedImport = useCallback(
    async (row: SavedImport) => {
      setOpeningId(row.id);
      setError(null);
      try {
        const res = await (apiClient as any).get(
          `/budgeting/statements/${row.id}/analysis/`,
        );
        setPreview({
          filename: row.filename || row.dialect_label,
          bank: { slug: "", label: row.dialect_label },
          currency: res.data?.analysis?.currency ?? "",
          row_count: row.created_count,
          warnings: [],
          sample: res.data?.sample ?? [],
          analysis: res.data.analysis,
          allowance: allowance as Allowance,
        });
        setSaved(row);
        setSource(null);
        void requestInsight(res.data?.analysis);
      } catch (e) {
        logDevError("tools/statement-import/open", e);
        setError(t("tools.statementImport.errors.openFailed"));
      } finally {
        setOpeningId(null);
      }
    },
    [allowance, requestInsight, t],
  );

  const handleUndo = useCallback(
    async (id: number) => {
      try {
        await (apiClient as any).delete(`/budgeting/statements/${id}/`);
        if (saved?.id === id) setSaved(null);
        await loadMeta();
      } catch (e) {
        logDevError("tools/statement-import/undo", e);
        setError(t("tools.statementImport.errors.deleteFailed"));
      }
    },
    [loadMeta, saved, t],
  );

  const analysis = preview?.analysis;
  const maxCategory = useMemo(
    () => Math.max(...(analysis?.categories?.map((r) => r.spent) ?? [0]), 1),
    [analysis],
  );
  const savesLeft = allowance?.is_paid
    ? null
    : (allowance?.free_saves_remaining ?? 0);

  const toneColor = (tone: Insight["tone"]) =>
    tone === "warning" ? c.error : tone === "positive" ? c.primary : c.border;

  return (
    <>
      <Stack.Screen options={{ title: t("tools.statementImport.title") }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.screenPaddingX + gutter },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {analyzing ? (
          /* A PDF can take several seconds server-side. Replacing the upload
             card outright (rather than spinning inside the button) makes it
             obvious the app is working and stops a second tap. */
          <View
            style={[
              styles.dropCard,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
            accessibilityRole="progressbar"
            accessibilityLabel={t("tools.statementImport.analysing.title")}
          >
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={[styles.dropTitle, { color: c.text }]}>
              {t("tools.statementImport.analysing.title")}
            </Text>
            <Text style={[styles.dropHint, { color: c.textMuted }]}>
              {t(
                `tools.statementImport.analysing.${ANALYSING_STEPS[analysingStep]}`,
              )}
            </Text>
            <View style={styles.stepRow}>
              {ANALYSING_STEPS.map((step, index) => (
                <View
                  key={step}
                  style={[
                    styles.stepPip,
                    {
                      backgroundColor:
                        index <= analysingStep ? c.primary : c.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.dropCard,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text style={styles.dropIcon}>🧾</Text>
            <Text style={[styles.dropTitle, { color: c.text }]}>
              {t("tools.statementImport.dropzone.titleMobile")}
            </Text>
            <Text style={[styles.dropHint, { color: c.textMuted }]}>
              {t("tools.statementImport.dropzone.hintMobile")}
            </Text>
            <Pressable
              onPress={handlePick}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {t("tools.statementImport.dropzone.choose")}
              </Text>
            </Pressable>
            <Text style={[styles.dropFree, { color: c.textMuted }]}>
              {t("tools.statementImport.dropzone.footnote")}
            </Text>

            {/* Secondary escape hatch — and the only route on builds that
              predate the native file picker. */}
            {!pasteOpen ? (
              <Pressable
                onPress={() => setPasteOpen(true)}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={[styles.linkText, { color: c.primary }]}>
                  {t("tools.statementImport.paste.open")}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.pasteBlock}>
                <TextInput
                  value={pastedText}
                  onChangeText={setPastedText}
                  placeholder={t("tools.statementImport.paste.placeholder")}
                  placeholderTextColor={c.textFaint}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textAlignVertical="top"
                  style={[
                    styles.pasteInput,
                    { borderColor: c.border, color: c.text },
                  ]}
                />
                <Pressable
                  onPress={handleAnalyzePasted}
                  disabled={!pastedText.trim()}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: c.primary,
                      opacity:
                        analyzing || !pastedText.trim()
                          ? 0.6
                          : pressed
                            ? 0.85
                            : 1,
                    },
                  ]}
                >
                  {analyzing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {t("tools.statementImport.paste.analyze")}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        )}

        {error && (
          <View style={[styles.errorCard, { borderColor: c.error }]}>
            <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
          </View>
        )}

        {analysis && (
          <>
            <View
              style={[
                styles.card,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.text }]}>
                {t("tools.statementImport.summary.title", {
                  bank: preview?.bank?.label,
                })}
              </Text>
              <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
                {t("tools.statementImport.summary.range", {
                  count: analysis.transaction_count,
                  start: analysis.period_start,
                  end: analysis.period_end,
                })}
              </Text>
              {preview?.warnings?.map((warning) => (
                <Text
                  key={warning}
                  style={[styles.warning, { color: c.error }]}
                >
                  {warning}
                </Text>
              ))}
              <View style={styles.totalsRow}>
                {(
                  [
                    ["income", analysis.totals.income],
                    ["spent", analysis.totals.spent],
                    ["net", analysis.totals.net],
                  ] as const
                ).map(([key, value]) => (
                  <View key={key} style={styles.totalCell}>
                    <Text style={[styles.totalLabel, { color: c.textMuted }]}>
                      {t(`tools.statementImport.totals.${key}`)}
                    </Text>
                    <Text
                      style={[
                        styles.totalValue,
                        {
                          color: key === "net" && value < 0 ? c.error : c.text,
                        },
                      ]}
                    >
                      {money(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {(aiLoading || (aiBullets && aiBullets.length > 0)) && (
              <View
                style={[
                  styles.card,
                  { borderColor: c.primary, backgroundColor: c.surface },
                ]}
              >
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t("tools.statementImport.ai.title")}
                </Text>
                {aiLoading ? (
                  <ActivityIndicator color={c.primary} />
                ) : (
                  aiBullets?.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: c.primary }]}>
                        {"\u2022"}
                      </Text>
                      <Text style={[styles.bulletText, { color: c.text }]}>
                        {bullet}
                      </Text>
                    </View>
                  ))
                )}
                <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
                  {t("tools.statementImport.ai.privacy")}
                </Text>
              </View>
            )}

            {analysis.insights.length > 0 && (
              <View
                style={[
                  styles.card,
                  { borderColor: c.border, backgroundColor: c.surface },
                ]}
              >
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t("tools.statementImport.insights.title")}
                </Text>
                {analysis.insights.map((insight) => (
                  <View
                    key={`${insight.kind}-${insight.title}`}
                    style={[
                      styles.insightRow,
                      { borderLeftColor: toneColor(insight.tone) },
                    ]}
                  >
                    <Text style={[styles.insightTitle, { color: c.text }]}>
                      {insight.title}
                    </Text>
                    <Text
                      style={[styles.insightDetail, { color: c.textMuted }]}
                    >
                      {insight.detail}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View
              style={[
                styles.card,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.text }]}>
                {t("tools.statementImport.categories.title")}
              </Text>
              {analysis.categories.slice(0, 8).map((row) => (
                <View key={row.category} style={styles.catRow}>
                  <View style={styles.catRowTop}>
                    <Text style={[styles.catLabel, { color: c.text }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.catMeta, { color: c.textMuted }]}>
                      {money(row.spent)} · {Math.round(row.share)}%
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: c.border }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          backgroundColor: c.primary,
                          width: `${(row.spent / maxCategory) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {analysis.recurring.length > 0 && (
              <View
                style={[
                  styles.card,
                  { borderColor: c.border, backgroundColor: c.surface },
                ]}
              >
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t("tools.statementImport.recurring.title")}
                </Text>
                {analysis.recurring.map((row) => (
                  <View key={row.merchant} style={styles.listRow}>
                    <View style={styles.listRowText}>
                      <Text
                        numberOfLines={1}
                        style={[styles.listLabel, { color: c.text }]}
                      >
                        {row.merchant}
                      </Text>
                      <Text style={[styles.listMeta, { color: c.textMuted }]}>
                        {t("tools.statementImport.recurring.meta", {
                          count: row.occurrences,
                          category: row.category_label,
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.listMeta, { color: c.textMuted }]}>
                      {money(row.typical_amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View
              style={[
                styles.card,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <Text style={[styles.cardTitle, { color: c.text }]}>
                {t("tools.statementImport.sample.title")}
              </Text>
              {preview?.sample?.slice(0, 8).map((row, index) => (
                <View
                  key={`${row.date}-${row.description}-${index}`}
                  style={styles.listRow}
                >
                  <View style={styles.listRowText}>
                    <Text
                      numberOfLines={1}
                      style={[styles.listLabel, { color: c.text }]}
                    >
                      {row.merchant || row.description}
                    </Text>
                    <Text style={[styles.listMeta, { color: c.textMuted }]}>
                      {row.date} · {row.category_label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.listMeta,
                      { color: row.amount < 0 ? c.text : c.primary },
                    ]}
                  >
                    {money(row.amount)}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.card,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              {saved ? (
                <>
                  <Text style={[styles.cardTitle, { color: c.text }]}>
                    {t("tools.statementImport.save.done", {
                      count: saved.created_count,
                    })}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
                    {t("tools.statementImport.save.doneHint")}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push(href("/(tabs)/tools/budget-planner"))
                    }
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: c.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {t("tools.statementImport.save.openPlanner")}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.cardTitle, { color: c.text }]}>
                    {t("tools.statementImport.save.title")}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
                    {allowance?.is_paid
                      ? t("tools.statementImport.save.hintPaid")
                      : savesLeft && savesLeft > 0
                        ? t("tools.statementImport.save.hintFree", {
                            count: savesLeft,
                          })
                        : t("tools.statementImport.save.hintLocked")}
                  </Text>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: c.primary,
                        opacity: saving ? 0.6 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {allowance?.can_save === false
                          ? t("tools.statementImport.save.upgrade")
                          : t("tools.statementImport.save.cta")}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}

        <View
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {t("tools.statementImport.history.titleWithCount", {
              count: history.length,
            })}
          </Text>
          {allowance && !allowance.is_paid && !allowance.can_save && (
            <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
              {t("tools.statementImport.history.freeUsed")}
            </Text>
          )}
          {history.length === 0 && (
            <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
              {t("tools.statementImport.history.empty")}
            </Text>
          )}
          <View>
            {history.map((row) => (
              <View key={row.id} style={styles.listRow}>
                <Pressable
                  style={styles.listRowText}
                  onPress={() => openSavedImport(row)}
                  accessibilityRole="button"
                  accessibilityLabel={row.filename || row.dialect_label}
                  disabled={openingId === row.id}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.listLabel, { color: c.text }]}
                  >
                    {row.filename || row.dialect_label}
                  </Text>
                  <Text style={[styles.listMeta, { color: c.textMuted }]}>
                    {openingId === row.id
                      ? t("tools.statementImport.analysing.title")
                      : t("tools.statementImport.history.meta", {
                          count: row.created_count,
                          range: dateRange(row.period_start, row.period_end),
                        })}
                  </Text>
                </Pressable>
                {row.status === "completed" ? (
                  <Pressable
                    onPress={() => handleUndo(row.id)}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={[styles.undo, { color: c.error }]}>
                      {t("tools.statementImport.history.undo")}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.listMeta, { color: c.textMuted }]}>
                    {t("tools.statementImport.history.reverted")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <PlusBottomSheet
        visible={plusSheetVisible}
        onClose={() => setPlusSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
    gap: spacing.lg,
  },
  dropIcon: { fontSize: 34 },
  stepRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  stepPip: { height: 4, width: 34, borderRadius: 2 },
  dropCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  dropTitle: {
    fontSize: typography.md,
    fontWeight: "700",
    textAlign: "center",
  },
  dropHint: { fontSize: typography.xs, textAlign: "center", lineHeight: 17 },
  dropFree: { fontSize: typography.xs, textAlign: "center" },
  primaryBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    alignSelf: "stretch",
    marginTop: spacing.xs,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: typography.sm },
  linkText: {
    fontSize: typography.xs,
    fontWeight: "700",
    paddingVertical: spacing.xs,
  },
  pasteBlock: { alignSelf: "stretch", gap: spacing.sm },
  pasteInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 120,
    fontSize: typography.xs,
    // Statement rows are column-aligned; a proportional font makes the pasted
    // text unreadable while the user checks they grabbed the right range.
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  errorCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: { fontSize: typography.sm },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.md, fontWeight: "700" },
  cardSubtitle: { fontSize: typography.xs, lineHeight: 17 },
  warning: { fontSize: typography.xs, lineHeight: 17 },
  totalsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  totalCell: { flex: 1, gap: 2 },
  totalLabel: { fontSize: typography.xs, fontWeight: "700" },
  totalValue: { fontSize: typography.lg, fontWeight: "800" },
  insightRow: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    gap: 2,
    marginTop: spacing.xs,
  },
  insightTitle: { fontSize: typography.sm, fontWeight: "600" },
  insightDetail: { fontSize: typography.xs, lineHeight: 17 },
  catRow: { gap: spacing.xs, marginTop: spacing.xs },
  catRowTop: { flexDirection: "row", justifyContent: "space-between" },
  catLabel: { fontSize: typography.sm, fontWeight: "600", flex: 1 },
  catMeta: { fontSize: typography.xs },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  listRowText: { flex: 1, gap: 2 },
  bulletRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  bulletDot: { fontSize: typography.sm, fontWeight: "800" },
  bulletText: { flex: 1, fontSize: typography.sm, lineHeight: 20 },
  listLabel: { fontSize: typography.sm, fontWeight: "600" },
  listMeta: { fontSize: typography.xs },
  undo: { fontSize: typography.xs, fontWeight: "700" },
});
