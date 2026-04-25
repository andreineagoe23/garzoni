import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import { navIcons } from "../../theme/navIcons";
import { href } from "../../navigation/href";

export function HeaderChatButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href("/chat"))}
      accessibilityRole="button"
      accessibilityLabel="Open AI tutor"
      style={{ marginRight: 16, padding: 4 }}
    >
      <Ionicons
        name={navIcons.chat as keyof typeof Ionicons.glyphMap}
        size={22}
        color={colors.text}
      />
    </Pressable>
  );
}
