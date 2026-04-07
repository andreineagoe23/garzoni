import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  streakCount: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export default function StreakBanner({ streakCount, label = "Day streak", style }: Props) {
  const c = useThemeColors();
  if (!Number.isFinite(streakCount) || streakCount <= 0) return null;

  return (
    <View
      style={[
        styles.wrap,
        { borderColor: `${c.accent}55`, backgroundColor: `${c.accent}18` },
        style,
      ]}
    >
      <MaterialCommunityIcons name="fire" size={22} color={c.accent} />
      <View style={styles.copy}>
        <Text style={[styles.value, { color: c.text }]}>{streakCount}</Text>
        <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  copy: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  value: { fontSize: typography.xl, fontWeight: "800" },
  label: { fontSize: typography.sm, fontWeight: "600" },
});
