import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";
import Button from "./Button";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  /** e.g. “View plans” when the API returns 403 upgrade required */
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary action (e.g. open Feedback) */
  onReport?: () => void;
};

export default function ErrorState({
  message,
  onRetry,
  actionLabel,
  onAction,
  onReport,
}: ErrorStateProps) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxxl,
          gap: spacing.md,
        },
        icon: { fontSize: 40 },
        message: {
          fontSize: typography.base,
          color: c.error,
          textAlign: "center",
          lineHeight: 22,
        },
      }),
    [c],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
      {onAction && actionLabel ? (
        <Button variant="primary" size="sm" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onPress={onRetry}>
          {t("screenErrors.tryAgain")}
        </Button>
      ) : null}
      {onReport ? (
        <Button variant="ghost" size="sm" onPress={onReport}>
          {t("screenErrors.reportProblem")}
        </Button>
      ) : null}
    </View>
  );
}
