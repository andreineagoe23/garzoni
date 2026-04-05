import { Stack } from "expo-router";
import { useTheme } from "../../src/theme/ThemeContext";

export default function ToolsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Tools" }} />
      <Stack.Screen name="portfolio/index" options={{ title: "Portfolio Analyzer" }} />
      <Stack.Screen name="reality-check/index" options={{ title: "Goals Reality Check" }} />
      <Stack.Screen name="savings-calculator/index" options={{ title: "Savings Calculator" }} />
      <Stack.Screen name="calendar/index" options={{ title: "Economic Calendar" }} />
      <Stack.Screen name="next-steps/index" options={{ title: "Next Steps" }} />
      <Stack.Screen name="market-explorer/index" options={{ title: "Market Explorer" }} />
      <Stack.Screen name="basic-finance/index" options={{ title: "Basic Finance Tools" }} />
      <Stack.Screen name="financial-goals/index" options={{ title: "Financial Goals" }} />
      <Stack.Screen name="currency-tools/index" options={{ title: "Currency Tools" }} />
      <Stack.Screen name="financial-sandbox/index" options={{ title: "Financial Sandbox" }} />
      <Stack.Screen name="news-calendars/index" options={{ title: "Economic Calendar" }} />
      <Stack.Screen name="[tool]" options={{ title: "Tool" }} />
    </Stack>
  );
}
