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
        { opacity: dimmed ? 0.72 : pressed ? 0.88 : 1 },
      ]}
    >
      <GlassCard padding="none" style={styles.card}>
        {/* Left accent bar */}
        <View
          style={[styles.accentBar, { backgroundColor: tool.accentColor }]}
        />

        <View style={styles.content}>
          {/* Top row: icon + badges */}
          <View style={styles.topRow}>
            <Text style={styles.icon}>{emoji}</Text>
            <View style={styles.badges}>
              {tool.comingSoon && comingSoonLabel ? (
                <View
                  style={[
                    styles.plusChip,
                    { backgroundColor: "rgba(100,116,139,0.15)" },
                  ]}
                >
                  <Text style={[styles.plusText, { color: c.textMuted }]}>
                    {comingSoonLabel}
                  </Text>
                </View>
              ) : null}
              {tool.plusOnly && (
                <View
                  style={[
                    styles.plusChip,
                    { backgroundColor: "rgba(245,158,11,0.12)" },
                  ]}
                >
                  <Text style={[styles.plusText, { color: "#f59e0b" }]}>
                    ✦ Plus
                  </Text>
                </View>
              )}
              {tool.estimatedMinutes != null && (
                <View style={[styles.timeChip, { backgroundColor: c.border }]}>
                  <Text style={[styles.timeText, { color: c.textMuted }]}>
                    {tool.estimatedMinutes} min
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text style={[styles.title, { color: c.text }]}>{tool.title}</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>
            {tool.subtitle}
          </Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    overflow: "hidden",
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  badges: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  plusChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  plusText: {
    fontSize: typography.xs,
    fontWeight: "700",
  },
  timeChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  timeText: {
    fontSize: typography.xs,
  },
  title: {
    fontSize: typography.md,
    fontWeight: "700",
  },
  sub: {
    fontSize: typography.sm,
    lineHeight: 18,
  },
});
