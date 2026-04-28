import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { href } from "../../navigation/href";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import {
  MOBILE_TOOLS,
  GROUP_LABELS,
  type ToolGroup,
} from "./mobileToolsRegistry";

const ICON_MAP: Record<string, string> = {
  CalendarDays: "📅",
  PieChart: "📊",
  Target: "🎯",
  Globe: "🌍",
  Rss: "📰",
  TrendingUp: "📈",
  Footprints: "👣",
  PiggyBank: "🐷",
  Map: "🗺️",
  Newspaper: "📰",
};

const GROUPS: ToolGroup[] = [
  "understand-world",
  "understand-myself",
  "decide-next",
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ToolSwitcherSheet({ visible, onClose }: Props) {
  const c = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();

  function navigate(route: string) {
    onClose();
    router.push(href(`/(tabs)/tools/${route}`));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        <Text style={[styles.heading, { color: c.text }]}>Switch Tool</Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {GROUPS.map((group, gi) => {
            const tools = MOBILE_TOOLS.filter((t) => t.group === group);
            return (
              <View key={group} style={gi > 0 ? styles.groupSep : undefined}>
                <Text style={[styles.groupLabel, { color: c.textFaint }]}>
                  {GROUP_LABELS[group].toUpperCase()}
                </Text>
                {tools.map((tool) => {
                  const isActive = pathname.includes(tool.route);
                  const emoji = ICON_MAP[tool.icon] ?? "🔧";
                  return (
                    <Pressable
                      key={tool.id}
                      onPress={() => navigate(tool.route)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          backgroundColor: isActive
                            ? c.primary + "18"
                            : pressed
                              ? c.surfaceOffset
                              : "transparent",
                          borderRadius: radius.lg,
                        },
                      ]}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.toolTitle,
                            { color: isActive ? c.primary : c.text },
                          ]}
                        >
                          {tool.title}
                        </Text>
                        <Text
                          style={[styles.toolSub, { color: c.textMuted }]}
                          numberOfLines={1}
                        >
                          {tool.subtitle}
                        </Text>
                      </View>
                      {tool.plusOnly && (
                        <Text style={[styles.plusBadge, { color: c.accent }]}>
                          ✦
                        </Text>
                      )}
                      {isActive && (
                        <View
                          style={[
                            styles.activeDot,
                            { backgroundColor: c.primary },
                          ]}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxxl,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: typography.base,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  groupSep: {
    marginTop: spacing.xl,
  },
  groupLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: spacing.md,
    marginBottom: 2,
  },
  emoji: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  toolTitle: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
  toolSub: {
    fontSize: typography.xs,
    marginTop: 1,
  },
  plusBadge: {
    fontSize: typography.xs,
    fontWeight: "700",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
