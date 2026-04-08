import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";
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

export default function SettingsScreen() {
  const c = useThemeColors();
  const { resolved, setMode } = useTheme();
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: queryKeys.userSettings(),
    queryFn: () => fetchUserSettings().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const mutation = useMutation({
    mutationFn: patchUserSettings,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.userSettings() }),
  });

  const soundOn = settingsQ.data?.sound_enabled !== false;
  const animOn = settingsQ.data?.animations_enabled !== false;
  const emailReminder = settingsQ.data?.email_reminder_preference === "enabled";

  return (
    <>
      <Stack.Screen
        options={{
          title: "Settings",
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      >
        <Text style={[styles.section, { color: c.accent }]}>Appearance</Text>
        <View
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Row
            label="Dark mode"
            value={resolved === "dark"}
            onValueChange={(v) => setMode(v ? "dark" : "light")}
            c={c}
          />
        </View>

        <Text style={[styles.section, { color: c.accent }]}>Language</Text>
        <View
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
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
        </View>

        <Text style={[styles.section, { color: c.accent }]}>Preferences</Text>
        <View
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Row
            label="Sound effects"
            value={soundOn}
            onValueChange={(v) => mutation.mutate({ sound_enabled: v })}
            c={c}
          />
          <Row
            label="Animations"
            value={animOn}
            onValueChange={(v) => mutation.mutate({ animations_enabled: v })}
            c={c}
          />
          <Row
            label="Email reminders"
            value={emailReminder}
            onValueChange={(v) =>
              mutation.mutate({
                email_reminder_preference: v ? "enabled" : "disabled",
              })
            }
            c={c}
          />
        </View>

        <Text style={[styles.muted, { color: c.textFaint }]}>
          Push notifications and hearts UI visibility stay on the Profile tab.
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
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
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
});
