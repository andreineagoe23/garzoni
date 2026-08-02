import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Mission, MissionActionKind } from "@garzoni/core";
import { getMissionPresentation } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import ProgressBar from "../ui/ProgressBar";
import { spacing, typography } from "../../theme/tokens";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  bookOpen: "book-outline",
  chartLine: "trending-up-outline",
  target: "checkmark-done-outline",
  lightbulb: "bulb-outline",
  rocket: "rocket-outline",
};

export type MissionCardProps = {
  mission: Mission;
  isDaily: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  canSwap: boolean;
  /** Level-aware fallback when the mission carries no `required_lessons`. */
  lessonRequirement: number;
  onSwap: (missionId: number) => void;
  /** Savings/fact CTAs open the action sheet; route CTAs navigate. */
  onAction: (mission: Mission, kind: MissionActionKind) => void;
};

/**
 * One mission = one action row: icon, name, progress fraction, XP, one CTA.
 * The savings jar and fact reader used to be embedded here, which is what made
 * the board 260px per mission; they live in the action sheet now.
 */
export default function MissionCard({
  mission,
  isDaily,
  t,
  canSwap,
  lessonRequirement,
  onSwap,
  onAction,
}: MissionCardProps) {
  const c = useThemeColors();
  const isCompleted = mission.status === "completed";
  const presentation = getMissionPresentation(mission, {
    isDaily,
    lessonRequirement,
  });
  const title =
    mission.mission_name || mission.name || t("missions.missionFallback");
  const xp = mission.points_reward ?? 0;

  if (isCompleted) {
    return (
      <GlassCard padding="sm" style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconTile, { backgroundColor: c.successBg }]}>
            <Ionicons name="checkmark" size={16} color={c.success} />
          </View>
          <View style={styles.body}>
            <Text
              style={[styles.title, { color: c.textMuted }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={[styles.detail, { color: c.textMuted }]}>
              {t("missions.progress.completed")}
            </Text>
          </View>
          <Text style={[styles.xp, { color: c.success }]}>
            {t("missions.xpPill", { xp })}
          </Text>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="sm" style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconTile, { backgroundColor: `${c.primary}1a` }]}>
          <Ionicons
            name={ICONS[presentation.iconName] ?? "flag-outline"}
            size={16}
            color={c.primary}
          />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.xp, { color: c.primary }]}>
              {t("missions.xpPill", { xp })}
            </Text>
          </View>
          <ProgressBar
            value={presentation.percent / 100}
            color={c.primary}
            height={6}
            style={{ marginTop: spacing.xs }}
          />
          <Text
            style={[styles.detail, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {t(presentation.progressKey, presentation.progressParams)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {presentation.ctaLabelKey ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(presentation.ctaLabelKey)}
            onPress={() => {
              if (
                presentation.actionKind === "route" &&
                presentation.mobileRoute
              ) {
                router.push(presentation.mobileRoute as Href);
                return;
              }
              onAction(mission, presentation.actionKind);
            }}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: c.textOnPrimary }]}>
              {t(presentation.ctaLabelKey)}
            </Text>
          </Pressable>
        ) : null}
        {canSwap && isDaily ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("missions.swap.aria", { name: title })}
            onPress={() => onSwap(Number(mission.id))}
            style={({ pressed }) => [
              styles.swap,
              { borderColor: c.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="swap-horizontal" size={14} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: typography.sm, fontWeight: "700" },
  xp: { fontSize: typography.xs, fontWeight: "800" },
  detail: { fontSize: typography.xs, marginTop: 4 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cta: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { fontSize: typography.xs, fontWeight: "700" },
  swap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
