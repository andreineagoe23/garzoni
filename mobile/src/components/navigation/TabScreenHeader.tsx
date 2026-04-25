import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
};

export default function TabScreenHeader({ title, left, right }: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: c.bg,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={styles.side}>{left ?? null}</View>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 0.5,
  },
  side: {
    width: 80,
    alignItems: "flex-start",
  },
  sideRight: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.md,
    fontWeight: "700",
    textAlign: "center",
  },
});
