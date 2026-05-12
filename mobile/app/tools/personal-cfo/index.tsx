import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  apiClient,
  fetchEntitlements,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { radius, spacing, typography } from "../../../src/theme/tokens";
import { href } from "../../../src/navigation/href";
import { trackGarzoniEvent } from "../../../src/bootstrap/customerIoMobile";
import { logDevError } from "../../../src/lib/logDevError";
import CFODashboard from "../../../src/components/tools/cfo/CFODashboard";

const COMPLETION_STORAGE_KEY = "garzoni:tools:personal-cfo:completed-steps";
const VIEW_PREF_KEY = "garzoni:tools:personal-cfo:view";

type StepId =
  | "goals"
  | "savings"
  | "budget"
  | "portfolio"
  | "market"
  | "next-steps";

type StepPhase = "live" | "preview";

type StepDef = {
  id: StepId;
  job: "plan" | "track" | "invest" | "scout" | "act";
  route: string;
  iconKey: string;
  phase: StepPhase;
  estimatedMinutes: number;
};

const STEPS: StepDef[] = [
  {
    id: "goals",
    job: "plan",
    route: "reality-check",
    iconKey: "🎯",
    phase: "live",
    estimatedMinutes: 8,
  },
  {
    id: "savings",
    job: "plan",
    route: "savings-goals",
    iconKey: "🐷",
    phase: "live",
    estimatedMinutes: 10,
  },
  {
    id: "budget",
    job: "track",
    route: "budget-planner",
    iconKey: "👛",
    phase: "preview",
    estimatedMinutes: 12,
  },
  {
    id: "portfolio",
    job: "invest",
    route: "portfolio",
    iconKey: "📊",
    phase: "live",
    estimatedMinutes: 12,
  },
  {
    id: "market",
    job: "scout",
    route: "market-explorer",
    iconKey: "📈",
    phase: "live",
    estimatedMinutes: 10,
  },
  {
    id: "next-steps",
    job: "act",
    route: "next-steps",
    iconKey: "👣",
    phase: "live",
    estimatedMinutes: 5,
  },
];

type CFOSummary = {
  status: string;
  generated_at?: string | null;
  highlights?: string[];
  alerts?: string[];
  next_action?: { label: string; href?: string | null } | null;
};

export default function PersonalCfoScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [completed, setCompleted] = useState<Set<StepId>>(() => new Set());
  const [summary, setSummary] = useState<CFOSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [viewPref, setViewPref] = useState<"auto" | "steps">("auto");
  const [backendComplete, setBackendComplete] = useState(false);

  const entQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const hasPlus = ["plus", "pro"].includes(entQuery.data?.plan ?? "");

  useEffect(() => {
    if (entQuery.isFetched && !hasPlus) {
      router.replace(href("/(tabs)/tools"));
    }
  }, [entQuery.isFetched, hasPlus, router]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(COMPLETION_STORAGE_KEY);
        if (raw) {
          const ids = JSON.parse(raw) as StepId[];
          setCompleted(new Set(ids));
        }
        const pref = await AsyncStorage.getItem(VIEW_PREF_KEY);
        if (pref === "steps") setViewPref("steps");
      } catch (e) {
        logDevError("tools/personal-cfo/load-completed", e);
      }
    })();
    void trackGarzoniEvent("personal_cfo_open", { surface: "mobile" });
  }, []);

  useEffect(() => {
    if (!entQuery.isFetched || !hasPlus) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await (apiClient as any).get("/personal-cfo/progress/");
        if (cancelled) return;
        const payload = res.data as {
          steps?: Partial<Record<StepId, boolean>>;
          completion?: { is_complete?: boolean };
        };
        setBackendComplete(Boolean(payload?.completion?.is_complete));
        if (payload?.steps) {
          setCompleted((prev) => {
            const next = new Set(prev);
            let changed = false;
            for (const step of STEPS) {
              if (payload.steps?.[step.id] && !next.has(step.id)) {
                next.add(step.id);
                changed = true;
              }
            }
            if (changed) {
              void AsyncStorage.setItem(
                COMPLETION_STORAGE_KEY,
                JSON.stringify(Array.from(next)),
              );
              return next;
            }
            return prev;
          });
        }
      } catch (e) {
        logDevError("tools/personal-cfo/progress", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entQuery.isFetched, hasPlus]);

  useEffect(() => {
    if (!entQuery.isFetched || !hasPlus) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await (apiClient as any).get("/personal-cfo/summary/");
        if (cancelled) return;
        setSummary(res.data ?? null);
      } catch (e: any) {
        if (cancelled) return;
        if (e?.response?.status === 402) {
          setSummaryError(t("tools.personalCfo.errors.upgradeRequired"));
        } else if (e?.response?.status === 404) {
          setSummary(null);
        } else {
          setSummaryError(t("tools.personalCfo.errors.summaryFailed"));
          logDevError("tools/personal-cfo/summary", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entQuery.isFetched, hasPlus, t]);

  const persist = useCallback(async (next: Set<StepId>) => {
    try {
      await AsyncStorage.setItem(
        COMPLETION_STORAGE_KEY,
        JSON.stringify(Array.from(next)),
      );
    } catch (e) {
      logDevError("tools/personal-cfo/persist", e);
    }
  }, []);

  const completionPercent = useMemo(() => {
    const live = STEPS.filter((s) => s.phase === "live").length;
    const done = STEPS.filter(
      (s) => s.phase === "live" && completed.has(s.id),
    ).length;
    return live === 0 ? 0 : Math.round((done / live) * 100);
  }, [completed]);

  const handleStep = useCallback(
    (step: StepDef) => {
      setCompleted((prev) => {
        if (prev.has(step.id)) return prev;
        const next = new Set(prev);
        next.add(step.id);
        void persist(next);
        return next;
      });
      void trackGarzoniEvent("personal_cfo_step_click", {
        step_id: step.id,
        target_tool: step.route,
        phase: step.phase,
        surface: "mobile",
      });
      router.push(href(`/(tabs)/tools/${step.route}`));
    },
    [persist, router],
  );

  const toggleStep = useCallback(
    (stepId: StepId) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        if (next.has(stepId)) {
          next.delete(stepId);
        } else {
          next.add(stepId);
        }
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  useEffect(() => {
    if (completionPercent < 100) return;
    void trackGarzoniEvent("personal_cfo_completed", { surface: "mobile" });
  }, [completionPercent]);

  const persistViewPref = useCallback((pref: "auto" | "steps") => {
    setViewPref(pref);
    void AsyncStorage.setItem(VIEW_PREF_KEY, pref).catch(() => undefined);
  }, []);

  const openCoach = useCallback(() => {
    void trackGarzoniEvent("personal_cfo_coach_open", { surface: "mobile" });
    router.push(href("/(tabs)/tools/personal-cfo-coach"));
  }, [router]);

  const isFullyComplete = backendComplete || completionPercent >= 100;
  const showDashboard = isFullyComplete && viewPref === "auto";

  if (!entQuery.isFetched) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: "Personal CFO" }} />
      </View>
    );
  }

  if (showDashboard) {
    return (
      <>
        <Stack.Screen options={{ title: "Personal CFO" }} />
        <ScrollView
          style={[styles.root, { backgroundColor: c.bg }]}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <CFODashboard
            onReviewSteps={() => persistViewPref("steps")}
            onOpenCoach={openCoach}
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Personal CFO" }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isFullyComplete && viewPref === "steps" && (
          <Pressable
            onPress={() => persistViewPref("auto")}
            style={({ pressed }) => [
              styles.openDashboardBtn,
              {
                backgroundColor: c.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.openDashboardText}>
              {t("tools.personalCfo.openDashboard")} →
            </Text>
          </Pressable>
        )}
        <View style={styles.headerBlock}>
          <Text style={[styles.eyebrow, { color: c.textMuted }]}>
            {t("tools.personalCfo.eyebrow").toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: c.text }]}>
            {t("tools.personalCfo.title")}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {t("tools.personalCfo.subtitle")}
          </Text>
        </View>

        <View
          style={[
            styles.progressCard,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <View style={styles.progressRow}>
            <Text style={[styles.progressTitle, { color: c.text }]}>
              {t("tools.personalCfo.progressTitle")}
            </Text>
            <Text style={[styles.progressPercent, { color: c.primary }]}>
              {completionPercent}%
            </Text>
          </View>
          <Text style={[styles.progressSub, { color: c.textMuted }]}>
            {t("tools.personalCfo.progressSubtitle", {
              done: STEPS.filter(
                (s) => s.phase === "live" && completed.has(s.id),
              ).length,
              total: STEPS.filter((s) => s.phase === "live").length,
            })}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${completionPercent}%`,
                  backgroundColor: c.primary,
                },
              ]}
            />
          </View>
        </View>

        {summary &&
          ((summary.highlights?.length ?? 0) > 0 ||
            (summary.alerts?.length ?? 0) > 0) && (
            <View
              style={[
                styles.summaryCard,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: c.text }]}>
                {t("tools.personalCfo.summary.title")}
              </Text>
              {summary.highlights?.map((line, idx) => (
                <View key={`hl-${idx}`} style={styles.bulletRow}>
                  <View
                    style={[styles.bullet, { backgroundColor: c.primary }]}
                  />
                  <Text style={[styles.bulletText, { color: c.text }]}>
                    {line}
                  </Text>
                </View>
              ))}
              {summary.alerts?.map((line, idx) => (
                <View key={`al-${idx}`} style={styles.bulletRow}>
                  <View
                    style={[styles.bullet, { backgroundColor: "#b45309" }]}
                  />
                  <Text style={[styles.bulletText, { color: "#b45309" }]}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          )}

        {summaryError && (
          <View
            style={[
              styles.errorCard,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text style={[styles.errorText, { color: c.textMuted }]}>
              {summaryError}
            </Text>
          </View>
        )}

        <View style={styles.stepsBlock}>
          {STEPS.map((step, index) => {
            const isDone = completed.has(step.id);
            const isPreview = step.phase === "preview";
            return (
              <Pressable
                key={step.id}
                onPress={() => handleStep(step)}
                style={({ pressed }) => [
                  styles.stepCard,
                  {
                    borderColor: c.border,
                    backgroundColor: c.surface,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.stepHeader}>
                  <View style={styles.stepHeaderLeft}>
                    <View
                      style={[
                        styles.stepIndex,
                        { backgroundColor: c.primary + "22" },
                      ]}
                    >
                      <Text
                        style={[styles.stepIndexText, { color: c.primary }]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={styles.stepEmoji}>{step.iconKey}</Text>
                  </View>
                  <View style={styles.stepChipsRow}>
                    {isPreview && (
                      <View
                        style={[styles.chip, { backgroundColor: "#b4530920" }]}
                      >
                        <Text style={[styles.chipText, { color: "#b45309" }]}>
                          {t("tools.personalCfo.badges.preview")}
                        </Text>
                      </View>
                    )}
                    {isDone && (
                      <View
                        style={[
                          styles.chip,
                          { backgroundColor: c.primary + "22" },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: c.primary }]}>
                          {t("tools.personalCfo.badges.done")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={[styles.stepTitle, { color: c.text }]}>
                  {t(`tools.personalCfo.steps.${step.id}.title`)}
                </Text>
                <Text style={[styles.stepDesc, { color: c.textMuted }]}>
                  {t(`tools.personalCfo.steps.${step.id}.description`)}
                </Text>

                <View style={styles.stepFooter}>
                  <Text style={[styles.stepMeta, { color: c.textFaint }]}>
                    {t("tools.personalCfo.estimatedMinutes", {
                      count: step.estimatedMinutes,
                    })}
                    {"  •  "}
                    {t(`tools.personalCfo.jobs.${step.job}`)}
                  </Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleStep(step.id);
                    }}
                    style={({ pressed }) => [
                      styles.checkBtn,
                      {
                        borderColor: c.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityLabel={
                      isDone
                        ? t("tools.personalCfo.markIncomplete")
                        : t("tools.personalCfo.markComplete")
                    }
                  >
                    <Text style={[styles.checkBtnText, { color: c.textMuted }]}>
                      {isDone ? "↺" : "✓"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.disclaimerCard,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.disclaimerTitle, { color: c.text }]}>
            {t("tools.personalCfo.disclaimer.title")}
          </Text>
          <Text style={[styles.disclaimerBody, { color: c.textMuted }]}>
            {t("tools.personalCfo.disclaimer.body")}
          </Text>
        </View>
      </ScrollView>
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
  headerBlock: { gap: spacing.xs },
  eyebrow: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: { fontSize: typography.xxl, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sm, lineHeight: 20 },
  progressCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: { fontSize: typography.md, fontWeight: "700" },
  progressPercent: { fontSize: typography.lg, fontWeight: "800" },
  progressSub: { fontSize: typography.xs },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  progressFill: { height: 6, borderRadius: 3 },
  summaryCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryTitle: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bulletRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { flex: 1, fontSize: typography.sm, lineHeight: 19 },
  errorCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  errorText: { fontSize: typography.sm },
  stepsBlock: { gap: spacing.md },
  stepCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  stepHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: { fontSize: 10, fontWeight: "800" },
  stepEmoji: { fontSize: 22 },
  stepChipsRow: { flexDirection: "row", gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  stepTitle: { fontSize: typography.md, fontWeight: "700" },
  stepDesc: { fontSize: typography.sm, lineHeight: 19 },
  stepFooter: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepMeta: { fontSize: typography.xs },
  checkBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBtnText: { fontSize: 14, fontWeight: "700" },
  disclaimerCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  disclaimerTitle: { fontSize: typography.sm, fontWeight: "700" },
  disclaimerBody: { fontSize: typography.xs, lineHeight: 16 },
  openDashboardBtn: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  openDashboardText: {
    color: "#fff",
    fontSize: typography.xs,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
