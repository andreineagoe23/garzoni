import { StyleSheet, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, radius } from "../../theme/tokens";
import TypingIndicator from "../chat/TypingIndicator";

type Props = {
  label: string;
};

export default function TypingBubble({ label }: Props) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: c.surfaceElevated,
          borderColor: c.border,
        },
      ]}
    >
      <TypingIndicator label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
