import { useState } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeContext";
import { navIcons } from "../../src/theme/navIcons";
import { typography } from "../../src/theme/tokens";
import AccountTabMenuModal from "../../src/components/navigation/AccountTabMenuModal";
import { HeaderAvatarButton } from "../../src/components/navigation/HeaderAvatarButton";
import { HeaderRightButtons } from "../../src/components/navigation/HeaderRightButtons";

const TAB_ICON: Record<
  string,
  {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: { active: navIcons.homeFilled, inactive: navIcons.home },
  learn: { active: navIcons.learnFilled, inactive: navIcons.learn },
  exercises: { active: navIcons.exercisesFilled, inactive: navIcons.exercises },
  tools: { active: navIcons.toolsFilled, inactive: navIcons.tools },
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation("common");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <>
      <AccountTabMenuModal
        visible={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
      <Tabs
        screenOptions={({ route }) => ({
          sceneStyle: { backgroundColor: colors.bg },
          headerTitleAlign: "center",
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: typography.md,
            color: colors.text,
          },
          headerStyle: { backgroundColor: colors.surface },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            borderTopColor: colors.border,
            borderTopWidth: 1,
            backgroundColor: colors.surface,
            height: 72,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: typography.xs,
            fontWeight: "600",
          },
          tabBarIcon: ({ focused, color, size }) => {
            if (route.name === "account-menu") {
              return (
                <View
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons
                    name={
                      (focused
                        ? navIcons.profileFilled
                        : navIcons.profile) as keyof typeof Ionicons.glyphMap
                    }
                    size={size}
                    color={color}
                  />
                  <Ionicons
                    name="chevron-down"
                    size={11}
                    color={color}
                    style={{ marginTop: -2 }}
                  />
                </View>
              );
            }
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
          options={{
            title: t("nav.dashboard", { defaultValue: "Home" }),
            headerLeft: () => <HeaderAvatarButton />,
            headerRight: () => <HeaderRightButtons />,
          }}
        />
        <Tabs.Screen
          name="learn"
          options={{ title: t("nav.learn", { defaultValue: "Learn" }) }}
        />
        <Tabs.Screen
          name="exercises"
          options={{ title: t("nav.exercises", { defaultValue: "Exercises" }) }}
        />
        <Tabs.Screen
          name="tools"
          options={{ title: t("nav.tools", { defaultValue: "Tools" }) }}
        />
        <Tabs.Screen
          name="missions"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="account-menu"
          options={{
            title: t("nav.ariaAccountMenu", { defaultValue: "Account" }),
            tabBarLabel: t("nav.menu", { defaultValue: "Account" }),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setAccountMenuOpen(true);
            },
          }}
        />
      </Tabs>
    </>
  );
}
