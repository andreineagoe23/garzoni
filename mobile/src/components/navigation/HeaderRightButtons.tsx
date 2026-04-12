import { View } from "react-native";
import { HeaderChatButton } from "./HeaderChatButton";
import { HeaderLanguageButton } from "./HeaderLanguageButton";
import { spacing } from "../../theme/tokens";

export function HeaderRightButtons() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginRight: spacing.md,
      }}
    >
      <HeaderLanguageButton />
      <HeaderChatButton />
    </View>
  );
}
