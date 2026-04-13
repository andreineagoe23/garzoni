import { Stack } from "expo-router";
import { useTheme } from "../../../src/theme/ThemeContext";

export default function ToolsStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
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
