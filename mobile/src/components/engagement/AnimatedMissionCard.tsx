import { type ReactNode } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

type Props = {
  index: number;
  children: ReactNode;
};

/** Staggered entrance for mission list items — calm fade-slide, no spring bounce. */
export default function AnimatedMissionCard({ index, children }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.duration(260).delay(Math.min(index * 40, 240))}
    >
      {children}
    </Animated.View>
  );
}
