import { Pressable } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeContext";
import { navIcons } from "../../src/theme/navIcons";
import { typography } from "../../src/theme/tokens";
import { href } from "../../src/navigation/href";

function HeaderChatButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href("/chat"))}
      accessibilityRole="button"
      accessibilityLabel="Open AI tutor"
      style={{ marginRight: 16, padding: 4 }}
    >
      <Ionicons name={navIcons.chat as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} />
    </Pressable>
  );
}

const TAB_ICON: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: navIcons.homeFilled, inactive: navIcons.home },
  learn: { active: navIcons.learnFilled, inactive: navIcons.learn },
  exercises: { active: navIcons.exercisesFilled, inactive: navIcons.exercises },
  missions: { active: navIcons.missionsFilled, inactive: navIcons.missions },
  profile: { active: navIcons.profileFilled, inactive: navIcons.profile },
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        headerTitleStyle: { fontWeight: "700", fontSize: typography.md, color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const entry = TAB_ICON[route.name];
          const name = entry
            ? focused
              ? entry.active
              : entry.inactive
            : "help-outline";
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", headerRight: () => <HeaderChatButton /> }}
      />
      <Tabs.Screen name="learn" options={{ title: "Learn" }} />
      <Tabs.Screen name="exercises" options={{ title: "Exercises" }} />
      <Tabs.Screen name="missions" options={{ title: "Missions" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
