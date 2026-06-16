import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import type { JourneyTrailModel } from "./journeyLayout";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Stepping-stone diameter along the footpath. */
const STONE = 17;
/** Distance between stone centers (dash gap + the dot itself). */
const STONE_GAP = "0.5 27";
const REVEAL_MS = 1100;

type Props = {
  trail: JourneyTrailModel;
  width: number;
  height: number;
  motionSimplify: boolean;
};

/** Pulsing gold marker at the end of the climbed portion of the trail. */
function ProgressTip({
  x,
  y,
  color,
  motionSimplify,
}: {
  x: number;
  y: number;
  color: string;
  motionSimplify: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (motionSimplify) return;
    t.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [t, motionSimplify]);
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * 1.6 }],
    opacity: 0.5 * (1 - t.value),
  }));
  return (
    <View
      pointerEvents="none"
      style={[styles.tipWrap, { left: x - 11, top: y - 11 }]}
    >
      {motionSimplify ? null : (
        <Animated.View
          style={[styles.tipHalo, { backgroundColor: color }, halo]}
        />
      )}
      <View style={[styles.tipDot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Mountain footpath: a winding line of stepping stones, not a paved road.
 * The climbed stretch tints the same stones green via a clip that sweeps up
 * from basecamp to the learner's current position.
 */
export default function JourneyTrail({
  trail,
  width,
  height,
  motionSimplify,
}: Props) {
  const { colors: c, resolved } = useTheme();
  const dark = resolved === "dark";

  const tipY = trail.progressTip?.y ?? height;
  // Climb reveal: the clip's top edge sweeps from the map bottom up to the tip.
  const clipTop = useSharedValue(motionSimplify ? tipY : height);
  useEffect(() => {
    if (motionSimplify) {
      clipTop.value = tipY;
      return;
    }
    clipTop.value = height;
    clipTop.value = withDelay(
      250,
      withTiming(tipY, {
        duration: REVEAL_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [clipTop, tipY, height, motionSimplify]);

  const clipProps = useAnimatedProps(() => ({
    y: clipTop.value,
    height: Math.max(height - clipTop.value, 0),
  }));

  if (!trail.d || trail.totalLength <= 0) return null;

  // Worn-dirt stepping stones with a soft ground shadow.
  const stone = dark ? "#7d6747" : "#c8aa7d";
  const stoneShadow = dark ? "rgba(0,0,0,0.45)" : "rgba(60,40,15,0.3)";
  const hasProgress = trail.progressLength > 1;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="trailProgress" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={c.primaryBright} />
            <Stop offset="1" stopColor={c.primary} />
          </LinearGradient>
          <ClipPath id="climbedClip">
            <AnimatedRect x={0} width={width} animatedProps={clipProps} />
          </ClipPath>
        </Defs>

        {/* Ground shadow under each stone */}
        <Path
          d={trail.d}
          stroke={stoneShadow}
          strokeWidth={STONE + 3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={STONE_GAP}
          transform="translate(0, 4)"
        />
        {/* The stones */}
        <Path
          d={trail.d}
          stroke={stone}
          strokeWidth={STONE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={STONE_GAP}
        />
        {/* Climbed stones turn brand green (clip sweeps up from basecamp) */}
        {hasProgress ? (
          <Path
            d={trail.d}
            stroke="url(#trailProgress)"
            strokeWidth={STONE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={STONE_GAP}
            clipPath="url(#climbedClip)"
          />
        ) : null}
      </Svg>

      {hasProgress && trail.progressTip ? (
        <ProgressTip
          x={trail.progressTip.x}
          y={trail.progressTip.y}
          color={c.accent}
          motionSimplify={motionSimplify}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tipWrap: {
    position: "absolute",
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tipHalo: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  tipDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: "#ffffff",
  },
});
