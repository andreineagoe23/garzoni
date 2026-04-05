import { type ReactNode } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

type Props = {
  index: number;
  children: ReactNode;
};

/** Staggered entrance for mission list items. */
export default function AnimatedMissionCard({ index, children }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.springify()
        .damping(16)
        .stiffness(200)
        .delay(Math.min(index * 48, 360))}
    >
      {children}
    </Animated.View>
  );
}
