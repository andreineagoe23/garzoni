import { type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { authBrand } from "../../theme/authBrand";
import { radius, shadows } from "../../theme/tokens";

type Props = {
  children: ReactNode;
};

export default function GlassAuthCard({ children }: Props) {
  return (
    <View style={styles.outer}>
      <BlurView
        intensity={Platform.OS === "ios" ? 55 : 40}
        tint={authBrand.cardTint}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.solidUnderlay} />
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
    borderColor: authBrand.glassBorder,
    ...shadows.lg,
  },
  solidUnderlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: authBrand.glassFill,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});
