import { Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";

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
    <Pressable
      onPress={() => {
        if (haptic)
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
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
        style={[
          styles.label,
          { color: active ? "#fff" : c.textMuted },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    lineHeight: 18,
  },
});
