import { useCallback } from "react";
import {
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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

/** Bottom tab bar (icons + label) — sheet sits just above this. */
const TAB_BAR_HEIGHT = 54;

export default function AccountTabMenuModal({ visible, onClose }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { resolved, toggleDark } = useTheme();
  const { clearSession } = useAuthSession();

  const sheetBottomPad = insets.bottom + TAB_BAR_HEIGHT + spacing.xs;
  const glassFill =
    resolved === "dark"
      ? "rgba(28,28,30,0.94)"
      : "rgba(248,248,250,0.96)";

  const go = useCallback(
    (path: string) => {
      onClose();
      // Close the native modal before pushing so the new screen’s header and
      // gestures are not blocked by a dismissing RN Modal (especially Android).
      InteractionManager.runAfterInteractions(() => {
        router.push(href(path));
      });
    },
    [onClose, router],
  );

  const signOut = useCallback(async () => {
    onClose();
    await clearSession();
    InteractionManager.runAfterInteractions(() => {
      router.replace(href("/welcome"));
    });
  }, [clearSession, onClose, router]);

  const menuRowStyle = [styles.menuRow, { borderBottomColor: c.border }];

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheetWrap, { paddingBottom: sheetBottomPad }]}
        >
          <GlassCard
            padding="none"
            style={styles.sheet}
            intensity={80}
            fillOverlay={glassFill}
          >
            <Text style={[styles.sheetTitle, { color: c.textMuted }]}>
              {t("nav.ariaAccountMenu", { defaultValue: "Account" })}
            </Text>
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {/* Account */}
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
                  name={
                    navIcons.chevronForward as keyof typeof Ionicons.glyphMap
                  }
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/subscriptions")}
                accessibilityRole="button"
              >
                <Ionicons name="card-outline" size={22} color={c.primary} />
                <Text style={[styles.menuLabel, { color: c.text }]}>
                  {t("billing.subscriptionManagement", {
                    defaultValue: "Subscription",
                  })}
                </Text>
                <Ionicons
                  name={
                    navIcons.chevronForward as keyof typeof Ionicons.glyphMap
                  }
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Navigate */}
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
                  name={
                    navIcons.chevronForward as keyof typeof Ionicons.glyphMap
                  }
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
                  name={
                    navIcons.chevronForward as keyof typeof Ionicons.glyphMap
                  }
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <Pressable
                style={menuRowStyle}
                onPress={() => go("/missions")}
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
                  name={
                    navIcons.chevronForward as keyof typeof Ionicons.glyphMap
                  }
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Preferences */}
              <Pressable
                style={menuRowStyle}
                onPress={() => toggleDark()}
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
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    paddingHorizontal: spacing.lg,
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
  scroll: { maxHeight: 480 },
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
});
