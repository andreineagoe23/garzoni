import { ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { href } from "../../src/navigation/href";
import { useQuery } from "@tanstack/react-query";
import { fetchEntitlements, queryKeys, staleTimes } from "@garzoni/core";
import ToolCard from "../../src/components/tools/ToolCard";
import { MOBILE_TOOLS } from "../../src/components/tools/mobileToolsRegistry";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";

export default function ToolsHubScreen() {
  const c = useThemeColors();
  const router = useRouter();

  const entQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });

  const plan = entQuery.data?.plan ?? "starter";
  const hasPlus = plan === "plus" || plan === "pro";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabScreenHeader title="Tools" />
      <ScrollView
        contentContainerStyle={styles.container}
      >
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Native tools — no web browser required.
      </Text>
      {MOBILE_TOOLS.map((tool) => {
        const locked = tool.plusOnly && !hasPlus;
        return (
          <View key={tool.id} style={{ marginBottom: spacing.md }}>
            <ToolCard
              tool={tool}
              locked={locked}
              onPress={() => {
                if (locked) {
                  Alert.alert(
                    "Plus / Pro",
                    "This tool requires a Plus or Pro plan.",
                  );
                  return;
                }
                router.push(href(`/tools/${tool.route}`));
              }}
            />
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 48 },
  sub: { fontSize: typography.sm, marginBottom: spacing.lg, lineHeight: 20 },
});
