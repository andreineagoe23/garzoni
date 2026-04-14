import { type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadows } from "../../theme/tokens";

type Props = {
  children: ReactNode;
};

/** Frosted card for auth — follows app light/dark theme (not hard-coded light glass). */
export default function GlassAuthCard({ children }: Props) {
  const { resolved, colors } = useTheme();
  const tint = resolved === "dark" ? "dark" : "light";

  return (
    <View
      style={[
        styles.outer,
        {
          borderColor: colors.glassBorder,
        },
        shadows.lg,
      ]}
    >
      <BlurView
        intensity={Platform.OS === "ios" ? 55 : 40}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[styles.solidUnderlay, { backgroundColor: colors.glassFill }]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    borderRadius: radius.xl + 4,
    overflow: "hidden",
    borderWidth: 1,
  },
  solidUnderlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});
