import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  fullScreen?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export default function LoadingSpinner({
  size = "md",
  color,
  fullScreen = false,
  label,
  style,
}: LoadingSpinnerProps) {
  const c = useThemeColors();
  const spinnerColor = color ?? c.primary;
  const rnSize = size === "lg" ? "large" : "small";

  const inner = (
    <View style={[styles.inner, style]}>
      <ActivityIndicator size={rnSize} color={spinnerColor} />
      {label ? (
        <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      ) : null}
    </View>
  );

  if (fullScreen) {
    return (
      <SafeAreaView style={[styles.fullScreen, { backgroundColor: c.bg }]}>
        {inner}
      </SafeAreaView>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: typography.sm,
    marginTop: spacing.sm,
  },
});
