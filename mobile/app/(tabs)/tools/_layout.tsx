import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/theme/ThemeContext";

export default function ToolsStackLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation("common");
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
        gestureEnabled: true,
        presentation: "card",
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
      <Stack.Screen
        name="portfolio"
        options={{ title: "Portfolio Analyzer" }}
      />
      <Stack.Screen
        name="reality-check"
        options={{ title: "Goals Reality Check" }}
      />
      <Stack.Screen name="calendar" options={{ title: "Economic Calendar" }} />
      <Stack.Screen name="next-steps" options={{ title: "Next Steps" }} />
      <Stack.Screen
        name="market-explorer"
        options={{ title: "Market Explorer" }}
      />
      <Stack.Screen name="[tool]" options={{ title: "Tool" }} />
    </Stack>
  );
}
