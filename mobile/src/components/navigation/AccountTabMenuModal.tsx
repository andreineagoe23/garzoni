import { useCallback } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  i18n,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from "@garzoni/core";
import { useAuthSession } from "../../auth/AuthContext";
import { href } from "../../navigation/href";
import { useTheme, useThemeColors } from "../../theme/ThemeContext";
import { navIcons } from "../../theme/navIcons";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountTabMenuModal({ visible, onClose }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const c = useThemeColors();
  const { resolved, toggleDark } = useTheme();
  const { clearSession } = useAuthSession();

  const go = useCallback(
    (path: string) => {
      onClose();
      router.push(href(path));
    },
    [onClose, router]
  );

  const signOut = useCallback(async () => {
    onClose();
    await clearSession();
    router.replace("/login");
  }, [clearSession, onClose, router]);

  const menuRowStyle = [styles.menuRow, { borderBottomColor: c.border }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={styles.sheetWrap}
        >
          <GlassCard padding="none" style={styles.sheet}>
            <Text style={[styles.sheetTitle, { color: c.textMuted }]}>
              {t("nav.ariaAccountMenu", { defaultValue: "Account" })}
            </Text>
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Pressable
                style={menuRowStyle}
                onPress={() => go("/(tabs)/profile")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.profile as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.profile", { defaultValue: "Profile" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/settings")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.settings as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.settings", { defaultValue: "Settings" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              <Text style={[styles.sectionLabel, { color: c.accent }]}>
                {t("nav.navigateSection", { defaultValue: "Navigate" })}
              </Text>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/leaderboard")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.leaderboard as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.leaderboard", { defaultValue: "Leaderboard" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/rewards")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.rewards as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.rewards", { defaultValue: "Rewards" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/(tabs)/missions")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.missions as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.missions", { defaultValue: "Missions" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/support")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.support as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.support", { defaultValue: "Support" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/feedback")}
                accessibilityRole="button"
              >
                <Ionicons
                  name={navIcons.chat as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("nav.sendFeedback", { defaultValue: "Send Feedback" })}
                </Text>
                <Ionicons
                  name={navIcons.chevronForward as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              <Text style={[styles.sectionLabel, { color: c.accent }]}>
                {t("language.label", { defaultValue: "Language" })}
              </Text>
              {SUPPORTED_LANGUAGES.filter(
                (l) => !("comingSoon" in l && l.comingSoon)
              ).map((lng) => {
                const active = normalizeLanguage(i18n.language) === lng.code;
                return (
                  <Pressable
                    key={lng.code}
                    style={[
                      styles.langRow,
                      {
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.accentMuted : "transparent",
                      },
                    ]}
                    onPress={() => void i18n.changeLanguage(lng.code)}
                  >
                    <Text style={[styles.menuLabel, { color: c.text }]}>
                      {lng.label}
                    </Text>
                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={c.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              <Pressable
                style={menuRowStyle}
                onPress={() => {
                  toggleDark();
                }}
                accessibilityRole="button"
              >
                <Ionicons
                  name={
                    (resolved === "dark"
                      ? navIcons.sun
                      : navIcons.moon) as keyof typeof Ionicons.glyphMap
                  }
                  size={22}
                  color={c.primary}
                />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("header.toggleDarkMode", { defaultValue: "Dark mode" })}
                </Text>
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  {resolved === "dark" ? "On" : "Off"}
                </Text>
              </Pressable>

              <Pressable
                style={[menuRowStyle, styles.lastRow]}
                onPress={() => void signOut()}
                accessibilityRole="button"
              >
                <Ionicons name="log-out-outline" size={22} color={c.error} />
                <Text style={[styles.menuLabel, { color: c.error }]}>
                  {t("nav.ariaLogout", { defaultValue: "Sign out" })}
                </Text>
              </Pressable>
            </ScrollView>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxHeight: "85%",
  },
  sheet: {
    maxHeight: "100%",
  },
  sheetTitle: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scroll: { maxHeight: 560 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: { borderBottomWidth: 0 },
  menuLabel: { flex: 1, fontSize: typography.base, fontWeight: "600" },
  hint: { fontSize: typography.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
