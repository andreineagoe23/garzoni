import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../../theme/ThemeContext";
import { navIcons } from "../../theme/navIcons";
import { href } from "../../navigation/href";
import ToolSwitcherSheet from "./ToolSwitcherSheet";

/**
 * Shared header controls for both tool stacks.
 *
 * There are two routes onto the same tool screens — `app/(tabs)/tools/*`
 * (tab bar visible) and the root `app/tools/*` group — and they used to carry
 * different headers, so switching tools made the ⊞ button vanish and the tab
 * bar appear. Both layouts now render the same controls.
 *
 * `headerLeft` always shows a back affordance: a deep link (mission quest step,
 * push, dashboard card) lands on the tool as the first entry of its stack, so
 * the navigator draws no back button of its own.
 */
const ICON_SIZE = 18;

const styles = StyleSheet.create({
  /**
   * Fixed square around the glyph. Without it the Pressable shrink-wraps the
   * icon and the header lays it out by its own rules, so the glyph drifted off
   * the header's optical centre — and 22px read oversized next to the title.
   */
  button: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function useToolsHeader(fallbackRoute = "/(tabs)/tools") {
  const { colors } = useTheme();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const headerRight = () => (
    <Pressable
      onPress={() => setSwitcherOpen(true)}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="Switch tool"
    >
      {/* Ionicons from the shared nav vocabulary — this was a raw "⊞" glyph,
          the only text-character icon in the app's chrome. */}
      <Ionicons
        name={navIcons.toolSwitcher}
        size={ICON_SIZE}
        color={colors.text}
      />
    </Pressable>
  );

  const headerLeft = () => (
    <Pressable
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace(href(fallbackRoute))
      }
      hitSlop={8}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={ICON_SIZE} color={colors.text} />
    </Pressable>
  );

  const switcher = (
    <ToolSwitcherSheet
      visible={switcherOpen}
      onClose={() => setSwitcherOpen(false)}
    />
  );

  return { headerRight, headerLeft, switcher };
}
