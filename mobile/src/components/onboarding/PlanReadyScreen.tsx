import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { fetchPlanSummary, type PlanSummary } from "@garzoni/core";
import { brand } from "../../theme/brand";
import LoadingSpinner from "../ui/LoadingSpinner";
import { trackEvent } from "../../lib/analytics";

const C = {
  bg: brand.bgDark,
  surface: brand.bgCard,
  surfaceRaised: "#161f2e",
  primary: brand.green,
  primaryBright: "#2a7347",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
};

// ── Ambient glow ─────────────────────────────────────────────────────────────
function Glow({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number;
  height: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="prg" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="65%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={height / 2}
        rx={width / 2}
        ry={height / 2}
        fill="url(#prg)"
      />
    </Svg>
  );
}

export type PlanReadyContinueOptions = {
  recommendedTier: "plus" | "pro";
  goalLabel?: string;
  /** Paywall placement experiment arm (3.5); undefined ⇒ "onboarding". */
  placement?: "onboarding" | "post_first_lesson";
  /** First curated lesson to open when the paywall is deferred to post-lesson. */
  firstCuratedLessonId?: number | null;
  /** Course of the first curated lesson — the flow route is keyed by course. */
  firstCuratedCourseId?: number | null;
};

type Props = {
  onContinue: (opts: PlanReadyContinueOptions) => void;
};

export default function PlanReadyScreen({ onContinue }: Props) {
  const { t } = useTranslation("common");

  const summaryQuery = useQuery<PlanSummary>({
    queryKey: ["onboarding", "planSummary"],
    queryFn: fetchPlanSummary,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const summary = summaryQuery.data ?? null;
  // Graceful generic fallback — never block onboarding if the fetch fails.
  const failed = summaryQuery.isError;

  const recommendedTier: "plus" | "pro" = summary?.recommended_tier ?? "plus";
  const primaryGoal = summary?.stated_goals?.[0]?.label;

  // Fire the view event once, after the fetch settles (success or failure).
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    if (summaryQuery.isLoading) return;
    viewedRef.current = true;
    trackEvent("plan_ready_view", {
      recommended_tier: recommendedTier,
      has_summary: !failed && summary != null,
      goal_count: summary?.stated_goals?.length ?? 0,
    });
  }, [summaryQuery.isLoading, recommendedTier, failed, summary]);

  const fade = useRef(new Animated.Value(0)).current;
  const fadeY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    if (summaryQuery.isLoading) return;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [summaryQuery.isLoading, fade, fadeY]);

  const placement = summary?.paywall_placement ?? "onboarding";
  const firstCuratedLessonId = summary?.curated_lessons?.[0]?.id ?? null;
  const firstCuratedCourseId = summary?.curated_lessons?.[0]?.course_id ?? null;

  const handleContinue = () => {
    trackEvent("plan_ready_continue", {
      recommended_tier: recommendedTier,
      goal: primaryGoal ?? null,
      placement,
    });
    onContinue({
      recommendedTier,
      goalLabel: primaryGoal,
      placement,
      firstCuratedLessonId,
      firstCuratedCourseId,
    });
  };

  if (summaryQuery.isLoading) {
    return (
      <View style={[s.screen, s.center]}>
        <LoadingSpinner size="lg" color={C.primaryBright} />
      </View>
    );
  }

  const goals = summary?.stated_goals ?? [];
  const lessons = summary?.curated_lessons ?? [];
  const outcomeText =
    summary?.projected_outcome?.text ||
    t("onboarding.planReady.outcomeFallback");

  return (
    <View style={s.screen}>
      <View style={s.ambientTop} pointerEvents="none">
        <Glow width={420} height={300} color={C.primary} opacity={0.2} />
      </View>
      <View style={s.ambientBottom} pointerEvents="none">
        <Glow width={340} height={240} color={C.goldWarm} opacity={0.06} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{ opacity: fade, transform: [{ translateY: fadeY }] }}
        >
          <Text style={s.eyebrow}>{t("onboarding.planReady.eyebrow")}</Text>
          <Text style={s.headline}>
            {t("onboarding.planReady.title")}{" "}
            <Text style={s.headlineEm}>
              {t("onboarding.planReady.titleEm")}
            </Text>
          </Text>
          <Text style={s.subhead}>{t("onboarding.planReady.subtitle")}</Text>

          {/* Goal chips */}
          {goals.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>
                {t("onboarding.planReady.goalsLabel")}
              </Text>
              <View style={s.chipWrap}>
                {goals.map((g) => (
                  <View key={g.key} style={s.chip}>
                    <Text style={s.chipText}>{g.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Curated lessons as numbered path steps */}
          {lessons.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>
                {t("onboarding.planReady.pathLabel")}
              </Text>
              <View style={s.pathList}>
                {lessons.slice(0, 3).map((lesson, i) => (
                  <View key={lesson.id} style={s.pathRow}>
                    <View style={s.pathNumWrap}>
                      <Text style={s.pathNum}>{i + 1}</Text>
                    </View>
                    <View style={s.pathTextWrap}>
                      <Text style={s.pathTitle} numberOfLines={2}>
                        {lesson.title}
                      </Text>
                      {lesson.topic ? (
                        <Text style={s.pathTopic}>{lesson.topic}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Projected outcome — emotional line */}
          <View style={s.outcomeCard}>
            <Text style={s.outcomeText}>{outcomeText}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA */}
      <View style={s.ctaWrap}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
        >
          <View style={s.ctaHighlight} pointerEvents="none" />
          {/* The label has to follow the placement. "See my plan options" was
              written for the onboarding arm, where this button opens the
              paywall. Under post_first_lesson it opens the first curated
              lesson instead, so the old copy promised a screen that never
              came. */}
          <Text style={s.ctaLabel}>
            {t(
              placement === "post_first_lesson"
                ? "onboarding.planReady.ctaStartLesson"
                : "onboarding.planReady.cta",
            )}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    overflow: "hidden",
  },
  center: { alignItems: "center", justifyContent: "center" },
  ambientTop: { position: "absolute", top: -70, alignSelf: "center" },
  ambientBottom: { position: "absolute", bottom: -40, right: -40 },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 24,
  },

  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: C.faint,
    fontWeight: "500",
    marginBottom: 12,
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: C.text,
  },
  headlineEm: {
    color: C.goldWarm,
    fontStyle: "italic",
  },
  subhead: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
    maxWidth: 340,
  },

  section: { marginTop: 28 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: C.faint,
    marginBottom: 12,
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(42,115,71,0.18)",
    borderWidth: 1,
    borderColor: "rgba(42,115,71,0.5)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },

  pathList: { gap: 10 },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.surfaceRaised,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pathNumWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pathNum: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  pathTextWrap: { flex: 1 },
  pathTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
    letterSpacing: -0.1,
  },
  pathTopic: {
    fontSize: 12,
    color: C.faint,
    marginTop: 2,
  },

  outcomeCard: {
    marginTop: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(230,200,122,0.3)",
    backgroundColor: "rgba(230,200,122,0.06)",
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  outcomeText: {
    fontSize: 16,
    lineHeight: 24,
    color: C.text,
    fontWeight: "500",
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
