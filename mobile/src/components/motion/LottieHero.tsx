import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import LottieView, { type AnimationObject } from "lottie-react-native";

type Props = {
  source: string | AnimationObject | { uri: string };
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  loop?: boolean;
  /** When true, skip animation (reduced motion placeholder). */
  reducedMotion?: boolean;
};

/**
 * Single wrapper for Lottie assets (onboarding, missions, rewards).
 * Pass `require("@/assets/lottie/foo.json")` as source.
 */
export default function LottieHero({
  source,
  style,
  autoPlay = true,
  loop = true,
  reducedMotion = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (reducedMotion || !mounted) {
    return <View style={[styles.fallback, style]} />;
  }

  return (
    <LottieView
      source={source}
      autoPlay={autoPlay}
      loop={loop}
      style={[styles.lottie, style]}
    />
  );
}

const styles = StyleSheet.create({
  lottie: { width: "100%", minHeight: 120 },
  fallback: { minHeight: 120, width: "100%" },
});
