import React, { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";

type Props = {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function CalculatorAccordion({
  title,
  icon,
  children,
  defaultOpen,
}: Props) {
  const c = useThemeColors();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const rotateAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.timing(rotateAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen(!open);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.8 : 1 }]}
        accessibilityRole="button"
      >
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        </View>
        <Animated.Text
          style={[
            styles.chevron,
            { color: c.textMuted, transform: [{ rotate }] },
          ]}
        >
          ▾
        </Animated.Text>
      </Pressable>
      {open && (
        <View style={[styles.body, { borderTopColor: c.border }]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { fontSize: 20 },
  title: { fontSize: typography.base, fontWeight: "700" },
  chevron: { fontSize: 18 },
  body: { borderTopWidth: 1, padding: spacing.lg, gap: spacing.lg },
});
