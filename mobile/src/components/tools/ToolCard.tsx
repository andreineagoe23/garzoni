import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { radius, spacing, typography } from "../../theme/tokens";
import type { MobileToolDef } from "./mobileToolsRegistry";

const ICON_MAP: Record<string, string> = {
  CalendarDays: "📅",
  PieChart: "📊",
  Target: "🎯",
  Globe: "🌍",
  Rss: "📰",
  TrendingUp: "📈",
  Footprints: "👣",
  PiggyBank: "🐷",
  Map: "🗺️",
  Newspaper: "📰",
};

type Props = {
  tool: MobileToolDef;
  onPress: () => void;
  comingSoonLabel?: string;
};

export default function ToolCard({ tool, onPress, comingSoonLabel }: Props) {
  const c = useThemeColors();
  const emoji = ICON_MAP[tool.icon] ?? "🔧";
  const dimmed = !!tool.comingSoon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        { opacity: dimmed ? 0.72 : pressed ? 0.88 : 1 },
      ]}
    >
      <GlassCard padding="none" style={styles.card} fillContent>
        <View style={styles.content}>
          {/* Top row: icon + badges */}
          <View style={styles.topRow}>
            <Text style={styles.icon}>{emoji}</Text>
            <View style={styles.chipRow}>
              {tool.comingSoon && comingSoonLabel ? (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: "rgba(100,116,139,0.15)" },
                  ]}
                >
                  <Text style={[styles.chipText, { color: c.textMuted }]}>
                    {comingSoonLabel}
                  </Text>
                </View>
              ) : null}
              {tool.plusOnly && (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: "rgba(255,215,0,0.12)" },
                  ]}
                >
                  <Text style={[styles.chipText, { color: c.accent }]}>
                    ✦ Plus
                  </Text>
                </View>
              )}
              {tool.estimatedMinutes != null && (
                <View style={[styles.chip, { backgroundColor: c.border }]}>
                  <Text style={[styles.chipText, { color: c.textMuted }]}>
                    {tool.estimatedMinutes} min
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {tool.title}
          </Text>

          {/* Subtitle */}
          <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={2}>
            {tool.subtitle}
          </Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    overflow: "hidden",
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xs,
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  icon: {
    fontSize: 26,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 1,
  },
  title: {
    fontSize: typography.md,
    fontWeight: "700",
  },
  sub: {
    fontSize: typography.xs,
    lineHeight: 16,
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: typography.xs,
    fontWeight: "700",
  },
});
