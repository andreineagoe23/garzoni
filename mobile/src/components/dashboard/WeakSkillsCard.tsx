import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { href } from "../../navigation/href";
import { useQuery } from "@tanstack/react-query";
import { fetchMasterySummary, queryKeys, staleTimes } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";

export default function WeakSkillsCard() {
  const c = useThemeColors();
  const q = useQuery({
    queryKey: queryKeys.masterySummary(),
    queryFn: () =>
      fetchMasterySummary().then(
        (r) =>
          r.data as {
            masteries?: Array<{
              skill?: string;
              proficiency?: number;
              level_label?: string;
            }>;
          },
      ),
    staleTime: staleTimes.progressSummary,
  });

  const weak =
    (q.data?.masteries ?? [])
      .filter((m) => (m.proficiency ?? 0) < 70)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))
      .slice(0, 8) ?? [];

  if (q.isPending) {
    return (
      <GlassCard padding="md">
        <Text style={{ color: c.textMuted }}>Loading skills…</Text>
      </GlassCard>
    );
  }

  if (weak.length === 0) {
    return (
      <GlassCard padding="md">
        <Text style={[styles.title, { color: c.accent }]}>Weak skills</Text>
        <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
          You&apos;re doing great — no weak skills detected right now.
        </Text>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="md">
      <Text style={[styles.title, { color: c.accent }]}>
        Practice weak skills
      </Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Tap a topic to jump into targeted exercises.
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ marginTop: spacing.md, gap: spacing.sm }}
      >
        {weak.map((m) => (
          <Pressable
            key={m.skill ?? Math.random().toString()}
            onPress={() =>
              router.push(
                href(
                  `/(tabs)/exercises?category=${encodeURIComponent(m.skill ?? "")}`,
                ),
              )
            }
            style={[
              styles.chip,
              { borderColor: c.border, backgroundColor: c.surfaceElevated },
            ]}
          >
            <Text
              style={[styles.chipTitle, { color: c.text }]}
              numberOfLines={1}
            >
              {m.skill}
            </Text>
            <Text style={[styles.chipMeta, { color: c.textMuted }]}>
              {m.level_label ?? `${m.proficiency ?? 0}%`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.md, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: 4 },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
    maxWidth: 160,
  },
  chipTitle: { fontSize: typography.sm, fontWeight: "700" },
  chipMeta: { fontSize: typography.xs, marginTop: 2 },
});
