import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { href } from "../../src/navigation/href";
import { useQuery } from "@tanstack/react-query";
import { fetchEntitlements, queryKeys, staleTimes } from "@garzoni/core";
import ToolCard from "../../src/components/tools/ToolCard";
import PlusBottomSheet from "../../src/components/tools/PlusBottomSheet";
import {
  GROUP_LABELS,
  MOBILE_TOOLS,
  type MobileToolDef,
  type ToolGroup,
} from "../../src/components/tools/mobileToolsRegistry";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { radius, spacing, typography } from "../../src/theme/tokens";
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";
import GlassCard from "../../src/components/ui/GlassCard";

const ALL_GROUPS: ToolGroup[] = [
  "understand-world",
  "understand-myself",
  "decide-next",
];

type FilterOption = ToolGroup | "all";

const FILTER_LABELS: Record<FilterOption, string> = {
  all: "All",
  "understand-world": "World",
  "understand-myself": "Myself",
  "decide-next": "Decide",
};

type Section = {
  group: ToolGroup;
  data: MobileToolDef[];
};

export default function ToolsHubScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [plusSheetVisible, setPlusSheetVisible] = useState(false);

  const entQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });

  const plan = entQuery.data?.plan ?? "starter";
  const hasPlus = plan === "plus" || plan === "pro";

  const sections = useMemo<Section[]>(() => {
    return ALL_GROUPS.filter(
      (g) => activeFilter === "all" || g === activeFilter,
    )
      .map((g) => ({
        group: g,
        data: MOBILE_TOOLS.filter((t) => t.group === g),
      }))
      .filter((s) => s.data.length > 0);
  }, [activeFilter]);

  const filters: FilterOption[] = ["all", ...ALL_GROUPS];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabScreenHeader title="Tools" />

      <GlassCard
        padding="md"
        style={{ marginHorizontal: spacing.xl, marginBottom: spacing.sm }}
      >
        <Text
          style={{ color: c.text, fontSize: typography.sm, fontWeight: "700" }}
        >
          {t("tools.hub.mobileWebParityTitle")}
        </Text>
        <Text
          style={{
            color: c.textMuted,
            fontSize: typography.xs,
            marginTop: spacing.xs,
            lineHeight: 18,
          }}
        >
          {t("tools.hub.mobileWebParityBody")}
        </Text>
      </GlassCard>

      {/* Group pill filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filters.map((f) => {
          const active = f === activeFilter;
          return (
            <Pressable
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? c.primary : c.surface,
                  borderColor: active ? c.primary : c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? "#fff" : c.textMuted },
                ]}
              >
                {FILTER_LABELS[f]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grouped tool list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: c.textFaint }]}>
            {GROUP_LABELS[section.group].toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => {
          const locked = !!item.plusOnly && !hasPlus;
          return (
            <View style={styles.cardWrap}>
              <ToolCard
                tool={item}
                onPress={() => {
                  if (locked) {
                    setPlusSheetVisible(true);
                    return;
                  }
                  router.push(href(`/(tabs)/tools/${item.route}`));
                }}
              />
            </View>
          );
        }}
        SectionSeparatorComponent={() => (
          <View style={{ height: spacing.xs }} />
        )}
      />

      <PlusBottomSheet
        visible={plusSheetVisible}
        onClose={() => setPlusSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  sectionHeader: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
});
