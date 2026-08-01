import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { Chip } from "../../src/components/ui";
import { useRouter } from "expo-router";
import { href } from "../../src/navigation/href";
import { useQuery } from "@tanstack/react-query";
import { fetchEntitlements, queryKeys, staleTimes } from "@garzoni/core";
import ToolCard from "../../src/components/tools/ToolCard";
import PlusBottomSheet from "../../src/components/tools/PlusBottomSheet";
import {
  MOBILE_TOOLS,
  type MobileToolDef,
  type ToolGroup,
} from "../../src/components/tools/mobileToolsRegistry";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { layout, spacing, typography } from "../../src/theme/tokens";
import { gridItemWidth, useResponsive } from "../../src/utils/platform";
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";
import { HeaderAvatarButton } from "../../src/components/navigation/HeaderAvatarButton";
import { HeaderRightButtons } from "../../src/components/navigation/HeaderRightButtons";
import { trackGarzoniEvent } from "../../src/bootstrap/customerIoMobile";

// Money-first ordering: personal finance tools surface before markets/news.
const ALL_GROUPS: ToolGroup[] = [
  "understand-myself",
  "personal-cfo",
  "decide-next",
  "understand-world",
];

type FilterOption = ToolGroup | "all";

type ToolRow = (MobileToolDef | null)[];

type Section = {
  group: ToolGroup;
  data: ToolRow[];
};

export default function ToolsHubScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const router = useRouter();
  const { width, isTablet, gutter, gridColumns } = useResponsive();
  const horizontalPad = layout.screenPaddingX + (isTablet ? gutter : 0);
  const availableWidth = width - horizontalPad * 2;
  // Phone: 2-up. Tablet: 3-up. Large tablet: 4-up.
  const columns = gridColumns(2, 3, 4);
  const cardWidth = gridItemWidth(availableWidth, columns, spacing.md);
  // Open on "My money" so the tab lands on personal finance, not everything at once.
  const [activeFilter, setActiveFilter] =
    useState<FilterOption>("understand-myself");
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
      .map((g) => {
        const tools = MOBILE_TOOLS.filter((t) => t.group === g);
        const rows: ToolRow[] = [];
        for (let i = 0; i < tools.length; i += columns) {
          const row: ToolRow = tools.slice(i, i + columns);
          while (row.length < columns) row.push(null);
          rows.push(row);
        }
        return { group: g, data: rows };
      })
      .filter((s) => s.data.length > 0);
  }, [activeFilter, columns]);

  const filters: FilterOption[] = ["all", ...ALL_GROUPS];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabScreenHeader
        title={t("nav.tools")}
        left={<HeaderAvatarButton />}
        right={<HeaderRightButtons />}
      />

      {/* Expectation-setter: these are planning/learning tools, not a linked bank. */}
      <Text
        style={[
          styles.notABankLine,
          { color: c.textMuted, paddingHorizontal: horizontalPad },
        ]}
      >
        {t("tools.hub.notABank", {
          defaultValue:
            "Plan and learn about your money — Garzoni doesn’t connect to your bank.",
        })}
      </Text>

      {/* Group pill filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // RN's ScrollView base style is `flexGrow: 1`, so a horizontal one
        // inside a flex column steals the leftover vertical space and (with
        // `alignItems: center` below) floats the chips in the middle of it.
        // Hug the content instead and let the SectionList own the remainder.
        style={styles.filterScroll}
        contentContainerStyle={[
          styles.filterRow,
          { paddingHorizontal: horizontalPad },
        ]}
      >
        {filters.map((f) => {
          const label =
            f === "all"
              ? t("tools.hub.filterAll")
              : t(`tools.groups.${f}.label`);
          return (
            <Chip
              key={f}
              label={label}
              active={f === activeFilter}
              onPress={() => setActiveFilter(f)}
            />
          );
        })}
      </ScrollView>

      {/* Grouped tool grid — fluid width, reflows columns on iPad */}
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((tl) => tl?.id ?? "empty").join("-")}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: horizontalPad },
        ]}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: c.textFaint }]}>
            {t(`tools.groups.${section.group}.title`).toUpperCase()}
          </Text>
        )}
        renderItem={({ item: row }) => {
          const renderCard = (tool: MobileToolDef) => {
            const locked = !!tool.plusOnly && !hasPlus;
            return (
              <ToolCard
                tool={tool}
                comingSoonLabel={
                  tool.comingSoon ? t("tools.hub.comingSoon") : undefined
                }
                onPress={() => {
                  if (tool.comingSoon) {
                    Toast.show({
                      type: "info",
                      text1: t("tools.hub.comingSoon"),
                      text2: t("tools.hub.comingSoonHint"),
                    });
                    return;
                  }
                  if (locked) {
                    void trackGarzoniEvent("personal_cfo_upgrade_prompt", {
                      source_tool: tool.id,
                      surface: "mobile",
                    });
                    setPlusSheetVisible(true);
                    return;
                  }
                  if (tool.id === "personal-cfo") {
                    void trackGarzoniEvent("personal_cfo_open", {
                      source: "tools_hub",
                      surface: "mobile",
                    });
                  }
                  router.push(href(`/(tabs)/tools/${tool.route}`));
                }}
              />
            );
          };

          return (
            <View style={[styles.row, { marginBottom: spacing.md }]}>
              {row.map((tool, i) => (
                <View
                  key={tool?.id ?? `empty-${i}`}
                  style={{ width: cardWidth, minHeight: 140 }}
                >
                  {tool ? renderCard(tool) : null}
                </View>
              ))}
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
  notABankLine: {
    fontSize: typography.xs,
    lineHeight: typography.xs + 6,
    marginTop: spacing.xs,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  list: {
    paddingBottom: spacing.xxxxl,
  },
  sectionHeader: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
