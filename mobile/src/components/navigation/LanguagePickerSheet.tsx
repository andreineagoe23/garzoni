import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { i18n, normalizeLanguage, SUPPORTED_LANGUAGES } from "@garzoni/core";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import GlassCard from "../ui/GlassCard";

type Props = {
  visible: boolean;
  onClose: () => void;
  anchorTop?: number;
  anchorRight?: number;
};

export function LanguagePickerSheet({
  visible,
  onClose,
  anchorTop,
  anchorRight,
}: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const activeLang = normalizeLanguage(i18n.language);

  const availableLanguages = SUPPORTED_LANGUAGES.filter(
    (l) => !("comingSoon" in l && l.comingSoon),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheetWrap,
            {
              top: anchorTop ?? insets.top + 44,
              right: anchorRight ?? spacing.md,
            },
          ]}
        >
          <GlassCard padding="none" style={styles.sheet}>
            <Text style={[styles.title, { color: c.textMuted }]}>Language</Text>
            <View style={styles.stack}>
              {availableLanguages.map((lng) => {
                const active = activeLang === lng.code;
                return (
                  <Pressable
                    key={lng.code}
                    style={[
                      styles.langItem,
                      {
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primarySoft : "transparent",
                      },
                    ]}
                    onPress={() => {
                      void i18n.changeLanguage(lng.code);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.langLabel,
                        { color: active ? c.primary : c.text },
                      ]}
                    >
                      {lng.label}
                    </Text>
                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={c.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  sheetWrap: {
    position: "absolute",
    right: spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  sheet: {
    minWidth: 164,
    borderRadius: radius.lg,
    zIndex: 1001,
    elevation: 1001,
  },
  title: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  stack: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 120,
  },
  langLabel: {
    fontSize: typography.sm,
    fontWeight: "600",
    flex: 1,
  },
});
