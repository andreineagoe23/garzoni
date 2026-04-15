import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { href } from "../src/navigation/href";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUserSettings,
  patchUserSettings,
  queryKeys,
  staleTimes,
  SUPPORTED_LANGUAGES,
  i18n,
  normalizeLanguage,
} from "@garzoni/core";
import { useTheme, useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import { useTranslation } from "react-i18next";
import GlassCard from "../src/components/ui/GlassCard";
import GlassButton from "../src/components/ui/GlassButton";

type EmailPrefs = {
  reminders: boolean;
  streak_alerts: boolean;
  weekly_digest: boolean;
  billing_alerts: boolean;
  marketing: boolean;
};

const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  reminders: true,
  streak_alerts: true,
  weekly_digest: true,
  billing_alerts: true,
  marketing: false,
};

type ReminderCadence = "none" | "weekly" | "monthly";

function normalizeReminderFromApi(raw: string | undefined): ReminderCadence {
  const pref = String(raw || "none");
  if (pref === "daily") return "weekly";
  if (pref === "weekly" || pref === "monthly" || pref === "none") return pref;
  return "none";
}

export default function SettingsScreen() {
  const c = useThemeColors();
  const { resolved, setMode } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation("common");

  const [emailReminderPreference, setEmailReminderPreference] =
    useState<ReminderCadence>("none");
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(DEFAULT_EMAIL_PREFS);

  const settingsQ = useQuery({
    queryKey: queryKeys.userSettings(),
    queryFn: () => fetchUserSettings().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  useEffect(() => {
    const d = settingsQ.data;
    if (!d) return;
    setEmailReminderPreference(
      normalizeReminderFromApi(d.email_reminder_preference),
    );
    const p = d.email_preferences as Record<string, unknown> | undefined;
    setEmailPrefs({
      reminders: Boolean(p?.reminders ?? true),
      streak_alerts: Boolean(p?.streak_alerts ?? true),
      weekly_digest: Boolean(p?.weekly_digest ?? true),
      billing_alerts: Boolean(p?.billing_alerts ?? true),
      marketing: Boolean(p?.marketing ?? false),
    });
  }, [settingsQ.data]);

  const mutation = useMutation({
    mutationFn: patchUserSettings,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.userSettings() }),
  });

  const patchPrefs = useCallback(
    (partial: Parameters<typeof patchUserSettings>[0]) => {
      mutation.mutate(partial);
    },
    [mutation],
  );

  const persistEmailBlock = useCallback(
    (nextPrefs: EmailPrefs, cadence: ReminderCadence) => {
      patchPrefs({
        email_reminder_preference: cadence,
        email_preferences: {
          ...nextPrefs,
          reminder_frequency: cadence,
        },
      });
    },
    [patchPrefs],
  );

  const soundOn = settingsQ.data?.sound_enabled !== false;
  const animOn = settingsQ.data?.animations_enabled !== false;

  const reminderOptions = useMemo(
    () =>
      [
        {
          value: "none" as const,
          label: t("settings.preferences.reminders.none"),
        },
        {
          value: "weekly" as const,
          label: t("settings.preferences.reminders.weekly"),
        },
        {
          value: "monthly" as const,
          label: t("settings.preferences.reminders.monthly"),
        },
      ] as const,
    [t],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: t("nav.settings"),
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      >
        <Text style={[styles.section, { color: c.accent }]}>
          {t("settings.preferences.title")}
        </Text>
        <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.cardLead, { color: c.textMuted }]}>
            {t("settings.preferences.subtitle")}
          </Text>

          <Text style={[styles.fieldLabel, { color: c.text }]}>
            {t("settings.preferences.emailReminders")}
          </Text>
          <View style={styles.segmentRow}>
            {reminderOptions.map((opt) => (
              <GlassButton
                key={opt.value}
                variant={
                  emailReminderPreference === opt.value ? "active" : "ghost"
                }
                size="sm"
                onPress={() => {
                  setEmailReminderPreference(opt.value);
                  persistEmailBlock(emailPrefs, opt.value);
                }}
              >
                {opt.label}
              </GlassButton>
            ))}
          </View>

          <EmailToggleRow
            label={t("settings.preferences.emailTypes.reminders")}
            value={emailPrefs.reminders}
            onValueChange={(v) => {
              const next = { ...emailPrefs, reminders: v };
              setEmailPrefs(next);
              persistEmailBlock(next, emailReminderPreference);
            }}
            c={c}
          />
          <EmailToggleRow
            label={t("settings.preferences.emailTypes.weeklyDigest")}
            value={emailPrefs.weekly_digest}
            onValueChange={(v) => {
              const next = { ...emailPrefs, weekly_digest: v };
              setEmailPrefs(next);
              persistEmailBlock(next, emailReminderPreference);
            }}
            c={c}
          />
          <EmailToggleRow
            label={t("settings.preferences.emailTypes.streakAlerts")}
            value={emailPrefs.streak_alerts}
            onValueChange={(v) => {
              const next = { ...emailPrefs, streak_alerts: v };
              setEmailPrefs(next);
              persistEmailBlock(next, emailReminderPreference);
            }}
            c={c}
          />
          <EmailToggleRow
            label={t("settings.preferences.emailTypes.billingAlerts")}
            value={emailPrefs.billing_alerts}
            onValueChange={(v) => {
              const next = { ...emailPrefs, billing_alerts: v };
              setEmailPrefs(next);
              persistEmailBlock(next, emailReminderPreference);
            }}
            c={c}
          />
          <EmailToggleRow
            label={t("settings.preferences.emailTypes.marketing")}
            value={emailPrefs.marketing}
            onValueChange={(v) => {
              const next = { ...emailPrefs, marketing: v };
              setEmailPrefs(next);
              persistEmailBlock(next, emailReminderPreference);
            }}
            c={c}
          />

          <View
            style={[
              styles.divider,
              { borderTopColor: c.border, marginVertical: spacing.md },
            ]}
          />
          <Row
            label={t("settings.preferences.lessonSounds")}
            value={soundOn}
            onValueChange={(v) => patchPrefs({ sound_enabled: v })}
            c={c}
          />
          <Row
            label={t("settings.preferences.animations")}
            value={animOn}
            onValueChange={(v) => patchPrefs({ animations_enabled: v })}
            c={c}
          />
        </GlassCard>

        <Text style={[styles.section, { color: c.accent }]}>
          {t("settings.mobile.appearance")}
        </Text>
        <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
          <Row
            label="Dark mode"
            value={resolved === "dark"}
            onValueChange={(v) => setMode(v ? "dark" : "light")}
            c={c}
          />
        </GlassCard>

        <Text style={[styles.section, { color: c.accent }]}>
          {t("language.label")}
        </Text>
        <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
          {SUPPORTED_LANGUAGES.filter(
            (l) => !("comingSoon" in l && l.comingSoon),
          ).map((lng) => {
            const active = normalizeLanguage(i18n.language) === lng.code;
            return (
              <Text
                key={lng.code}
                onPress={() => void i18n.changeLanguage(lng.code)}
                style={[
                  styles.lang,
                  {
                    borderColor: active ? c.primary : c.border,
                    color: c.text,
                    backgroundColor: active ? c.accentMuted : "transparent",
                  },
                ]}
              >
                {lng.label} {active ? "✓" : ""}
              </Text>
            );
          })}
        </GlassCard>

        <Text style={[styles.section, { color: c.accent }]}>
          Help & Feedback
        </Text>
        <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push(href("/support"))}
            accessibilityRole="button"
          >
            <Ionicons name="help-circle-outline" size={20} color={c.primary} />
            <Text style={[styles.linkLabel, { color: c.text }]}>Support</Text>
            <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
          </Pressable>
          <Pressable
            style={[
              styles.linkRow,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: c.border,
              },
            ]}
            onPress={() => router.push(href("/feedback"))}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-outline" size={20} color={c.primary} />
            <Text style={[styles.linkLabel, { color: c.text }]}>
              Send Feedback
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
          </Pressable>
        </GlassCard>

        <Text style={[styles.muted, { color: c.textFaint }]}>
          {t("settings.mobile.pushNote")}
        </Text>
      </ScrollView>
    </>
  );
}

function Row({
  label,
  value,
  onValueChange,
  c,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: c.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: c.primary, false: c.border }}
      />
    </View>
  );
}

function EmailToggleRow({
  label,
  value,
  onValueChange,
  c,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: c.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: c.primary, false: c.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 48 },
  section: {
    fontSize: typography.sm,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  cardLead: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  switchLabel: { fontSize: typography.base, flex: 1 },
  lang: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    fontSize: typography.base,
    fontWeight: "600",
  },
  muted: { fontSize: typography.xs, marginTop: spacing.xl, lineHeight: 18 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  linkLabel: { flex: 1, fontSize: typography.base, fontWeight: "600" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
});
