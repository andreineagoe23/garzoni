import { StyleSheet, Text } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import AppPressable from "./AppPressable";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  accentColor?: string;
  haptic?: boolean;
};

export default function Chip({
  label,
  active,
  onPress,
  accentColor,
  haptic = true,
}: Props) {
  const c = useThemeColors();
  const accent = accentColor ?? c.primary;
  return (
    <AppPressable
      onPress={onPress}
      haptic={haptic ? "light" : "none"}
      rippleColor={active ? "rgba(255,255,255,0.22)" : `${accent}33`}
      style={[
        styles.chip,
        {
          backgroundColor: active ? accent : c.surface,
          borderColor: active ? accent : c.border,
        },
      ]}
      hitSlop={6}
    >
      <Text
        style={[styles.label, { color: active ? "#fff" : c.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
