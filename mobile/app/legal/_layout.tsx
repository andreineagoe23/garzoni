import { Stack } from "expo-router";
import { useTheme } from "../../src/theme/ThemeContext";

export default function LegalLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="[page]" options={{ title: "Legal" }} />
    </Stack>
  );
}
