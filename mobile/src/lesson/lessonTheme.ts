import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useThemeColors } from "../theme/ThemeContext";
import type { ThemeColors } from "../theme/palettes";
import { radius, shadows, spacing, typography } from "../theme/tokens";

/**
 * One lesson look, shared by the demo lesson and the real lesson flow.
 *
 * The two drifted badly. `app/demo-lesson.tsx` built a private palette of raw
 * hex and off-scale padding and ended up feeling noticeably more alive than the
 * product it advertises — brighter green, gold rewards, a shadowed CTA with a
 * gloss strip. The real flow used the darker `primary` for its most-tapped
 * button, gave it no press feedback at all, and coloured a correct answer the
 * same green it uses for "this option is right".
 *
 * Every value here comes from the theme and the token scales, so the demo stops
 * being a pile of literals and the flow inherits the parts that made it feel
 * better. Change the look in one place and both move together.
 */

/**
 * Semantic roles for a lesson surface, resolved from the active theme.
 *
 * The names describe the job, not the colour, so dark and light both work and a
 * palette change lands here rather than in two screens.
 */
export function resolveLessonColors(c: ThemeColors) {
  return {
    bg: c.bg,
    surface: c.surface,
    /** Cards that sit above the page surface — options, prompts, panels. */
    surfaceRaised: c.surfaceElevated,
    border: c.border,
    /** Hairline dividers and inactive step pips. */
    borderFaint: c.borderSoft,

    text: c.text,
    textMuted: c.textMuted,
    textFaint: c.textFaint,
    textOnAction: c.textOnPrimary,

    /**
     * The action colour. Deliberately `primaryBright`, not `primary`: the
     * lesson flow used the darker brand green for its Continue button and
     * progress bar while the demo used the bright one, and that single step
     * of lift is the largest part of the difference people notice.
     */
    action: c.primaryBright,
    actionDeep: c.primary,

    /**
     * Reward gold. Distinct from `positive` on purpose — green says "that
     * answer was right", gold says "you earned something". The demo drew the
     * distinction and the flow did not.
     */
    reward: c.accent,
    rewardSoft: c.accentMuted,

    positive: c.success,
    positiveSoft: c.successBg,
    negative: c.error,
    negativeSoft: c.errorBg,
  };
}

export type LessonColors = ReturnType<typeof resolveLessonColors>;

/** Hook form. Prefer this in components; the pure resolver above exists for
 *  StyleSheet factories, which receive `ThemeColors` and cannot call hooks. */
export function useLessonColors(): LessonColors {
  const c = useThemeColors();
  return useMemo(() => resolveLessonColors(c), [c]);
}

/**
 * The shared lesson style map, as plain objects.
 *
 * Kept un-registered so callers that build their own `StyleSheet.create` map —
 * `createLessonFlowStyles` in LessonFlowScreen — can spread these into their
 * own entries. Everyone else should use `createLessonStyles`/`useLessonStyles`.
 */
export function lessonStyleObjects(lc: LessonColors) {
  return {
    screen: { flex: 1, backgroundColor: lc.bg },

    card: {
      backgroundColor: lc.surface,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: lc.border,
      padding: spacing.lg,
    },
    cardRaised: {
      backgroundColor: lc.surfaceRaised,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: lc.border,
      padding: spacing.lg,
    },

    /**
     * Primary action. Carries a real shadow — the flow's button was flat,
     * which is a large part of why it read as inert next to the demo's.
     */
    cta: {
      backgroundColor: lc.action,
      borderRadius: radius.full,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xxl,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      ...shadows.md,
    },
    /**
     * One-pixel gloss along the top edge of the CTA. Pure decoration, so
     * it must never eat the press — always render it with
     * `pointerEvents="none"`.
     */
    ctaHighlight: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: lc.rewardSoft,
    },
    ctaLabel: {
      color: lc.textOnAction,
      fontSize: typography.md,
      fontWeight: "700",
    },
    ctaDisabled: { opacity: 0.5 },

    progressTrack: {
      height: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: lc.borderFaint,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: radius.full,
      backgroundColor: lc.action,
    },

    /** Correct answers read as a reward, not as a marked exam paper. */
    feedbackCorrect: {
      color: lc.reward,
      fontSize: typography.md,
      fontWeight: "700",
    },
    feedbackWrong: {
      color: lc.negative,
      fontSize: typography.md,
      fontWeight: "700",
    },

    optionBase: {
      backgroundColor: lc.surfaceRaised,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: lc.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    optionCorrect: {
      borderColor: lc.positive,
      backgroundColor: lc.positiveSoft,
    },
    optionWrong: {
      borderColor: lc.negative,
      backgroundColor: lc.negativeSoft,
    },

    /** The per-answer XP pill — the demo's most-missed moment. */
    rewardPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      alignSelf: "flex-start",
      backgroundColor: lc.rewardSoft,
      borderRadius: radius.full,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    rewardPillText: {
      color: lc.reward,
      fontSize: typography.sm,
      fontWeight: "700",
    },
  } as const;
}

/** StyleSheet form, for a `ThemeColors` caller that cannot use hooks. */
export function createLessonStyles(c: ThemeColors) {
  const lc = resolveLessonColors(c);
  return { colors: lc, styles: StyleSheet.create(lessonStyleObjects(lc)) };
}

/**
 * Shared lesson styles. Anything a lesson and the demo both render should live
 * here rather than being written twice with slightly different numbers.
 */
export function useLessonStyles() {
  const c = useThemeColors();
  return useMemo(() => createLessonStyles(c), [c]);
}
