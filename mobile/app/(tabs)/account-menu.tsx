import { View } from "react-native";
import { useThemeColors } from "../../src/theme/ThemeContext";

/**
 * Placeholder route when the account tab is focused; tab press is intercepted to open the menu.
 */
export default function AccountMenuTabScreen() {
  const c = useThemeColors();
  return <View style={{ flex: 1, backgroundColor: c.bg }} />;
}
