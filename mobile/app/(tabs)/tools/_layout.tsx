import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/theme/ThemeContext";
import { useToolOpenEvent } from "../../../src/components/tools/useToolOpenEvent";
import { useToolsHeader } from "../../../src/components/tools/useToolsHeader";

export default function ToolsStackLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation("common");
  // Quest "tool" steps advance off this event; only the other stack fired it.
  useToolOpenEvent();
  // Same controls as the root tools stack — switching tools used to drop the
  // ⊞ button because only that other stack had it.
  const { headerRight, headerLeft, switcher } = useToolsHeader();

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
          gestureEnabled: true,
          presentation: "card",
          headerRight,
          headerLeft,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            // iOS back button uses previous route title; without this it shows "index".
            title: t("nav.tools"),
          }}
        />
        <Stack.Screen name="personal-cfo" options={{ title: "Personal CFO" }} />
        <Stack.Screen
          name="personal-cfo-coach"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen
          name="budget-planner"
          options={{ title: "Budget & Spending" }}
        />
        <Stack.Screen
          name="portfolio"
          options={{ title: "Portfolio Analyzer" }}
        />
        <Stack.Screen
          name="reality-check"
          options={{ title: "Goals Reality Check" }}
        />
        <Stack.Screen
          name="calendar"
          options={{ title: "Economic Calendar" }}
        />
        <Stack.Screen name="next-steps" options={{ title: "Next Steps" }} />
        <Stack.Screen
          name="market-explorer"
          options={{ title: "Market Explorer" }}
        />
        <Stack.Screen name="[tool]" options={{ title: "Tool" }} />
      </Stack>

      {switcher}
    </>
  );
}
