import { useEffect, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { Stack, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiClient } from "@garzoni/core";
import { useTheme } from "../../src/theme/ThemeContext";
import ToolSwitcherSheet from "../../src/components/tools/ToolSwitcherSheet";

function SwitcherButton({
  onPress,
  tintColor,
}: {
  onPress: () => void;
  tintColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 4 })}
      accessibilityRole="button"
      accessibilityLabel="Switch tool"
    >
      <Text style={{ fontSize: 17, color: tintColor }}>⊞</Text>
    </Pressable>
  );
}

export default function ToolsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation("common");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const pathname = usePathname();
  const activeToolSlug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "tools") return null;
    return parts[1] || null;
  }, [pathname]);

  useEffect(() => {
    if (!activeToolSlug) return;
    void (apiClient as any)
      .post("/funnel/events/", {
        event_type: "tool_open",
        metadata: {
          tool_slug: activeToolSlug,
          tool_name: activeToolSlug,
          source: "mobile_route",
          surface: "mobile",
        },
      })
      .catch(() => undefined);
  }, [activeToolSlug]);

  const headerRight = () => (
    <SwitcherButton
      onPress={() => setSwitcherOpen(true)}
      tintColor={colors.text}
    />
  );

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
          headerRight,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            title: t("nav.tools"),
          }}
        />
        <Stack.Screen
          name="personal-cfo/index"
          options={{ title: "Personal CFO" }}
        />
        <Stack.Screen
          name="personal-cfo-coach/index"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen
          name="budget-planner/index"
          options={{ title: "Budget & Spending" }}
        />
        <Stack.Screen
          name="portfolio/index"
          options={{ title: "Portfolio Analyzer" }}
        />
        <Stack.Screen
          name="reality-check/index"
          options={{ title: "Goals Reality Check" }}
        />
        <Stack.Screen
          name="calendar/index"
          options={{ title: "Economic Calendar" }}
        />
        <Stack.Screen
          name="next-steps/index"
          options={{ title: "Next Steps" }}
        />
        <Stack.Screen
          name="market-explorer/index"
          options={{ title: "Market Explorer" }}
        />
        <Stack.Screen name="[tool]" options={{ title: "Tool" }} />
      </Stack>

      <ToolSwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />
    </>
  );
}
