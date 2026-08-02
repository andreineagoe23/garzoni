import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeContext";
import { useToolOpenEvent } from "../../src/components/tools/useToolOpenEvent";
import { useToolsHeader } from "../../src/components/tools/useToolsHeader";

export default function ToolsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation("common");
  useToolOpenEvent();
  // Shared with app/(tabs)/tools so the ⊞ switcher and back control don't
  // change depending on which stack the user entered through.
  const { headerRight, headerLeft, switcher } = useToolsHeader("/tools");

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
          headerRight,
          headerLeft,
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
          name="statement-import/index"
          options={{ title: "Statement Import" }}
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

      {switcher}
    </>
  );
}
