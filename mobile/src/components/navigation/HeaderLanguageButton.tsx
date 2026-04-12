import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { i18n, normalizeLanguage } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import { LanguagePickerSheet } from "./LanguagePickerSheet";

export function HeaderLanguageButton() {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  const langCode = normalizeLanguage(i18n.language).toUpperCase().slice(0, 2);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Change language"
        style={[
          styles.button,
          { borderColor: c.border, backgroundColor: c.surface },
        ]}
      >
        <Text style={[styles.label, { color: c.text }]}>{langCode}</Text>
      </Pressable>
      <LanguagePickerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 30,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
