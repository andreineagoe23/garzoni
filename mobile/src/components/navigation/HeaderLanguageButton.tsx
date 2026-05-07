import { useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { i18n, normalizeLanguage } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import { LanguagePickerSheet } from "./LanguagePickerSheet";

export function HeaderLanguageButton() {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const [anchorTop, setAnchorTop] = useState<number | undefined>(undefined);
  const [anchorRight, setAnchorRight] = useState<number | undefined>(undefined);
  const buttonRef = useRef<View>(null);

  const langCode = normalizeLanguage(i18n.language).toUpperCase().slice(0, 2);

  const openPicker = () => {
    requestAnimationFrame(() => {
      buttonRef.current?.measureInWindow((x, y, width, height) => {
        const screenW = Dimensions.get("window").width;
        setAnchorTop(y + height + 35);
        setAnchorRight(Math.max(8, screenW - (x + width)));
        setOpen(true);
      });
    });
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel="Change language"
        style={[
          styles.button,
          { borderColor: c.border, backgroundColor: c.surface },
        ]}
      >
        <Text style={[styles.label, { color: c.text }]}>{langCode}</Text>
      </Pressable>
      <LanguagePickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        anchorTop={anchorTop}
        anchorRight={anchorRight}
      />
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
