import { useState } from "react";
import { Pressable, Text } from "react-native";
import { Stack } from "expo-router";
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
  const [switcherOpen, setSwitcherOpen] = useState(false);

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
        <Stack.Screen name="index" options={{ headerShown: false }} />
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
