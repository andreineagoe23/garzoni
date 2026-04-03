import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "../../src/theme/tokens";

const ICON_MAP: Record<string, { active: string; inactive: string }> = {
  index: { active: "home", inactive: "home-outline" },
  learn: { active: "book", inactive: "book-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        headerTitleStyle: { fontWeight: "700", fontSize: typography.md },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const entry = ICON_MAP[route.name];
          const name = entry
            ? focused
              ? entry.active
              : entry.inactive
            : "help-outline";
          return (
            <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="learn" options={{ title: "Learn" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
