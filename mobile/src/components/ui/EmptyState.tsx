import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";
import Button from "./Button";

type EmptyStateProps = {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const c = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxxl,
          gap: spacing.md,
        },
        icon: { fontSize: 48 },
        title: {
          fontSize: typography.lg,
          fontWeight: "700",
          color: c.text,
          textAlign: "center",
        },
        message: {
          fontSize: typography.base,
          color: c.textMuted,
          textAlign: "center",
          lineHeight: 22,
        },
      }),
    [c],
  );

  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" size="sm" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
