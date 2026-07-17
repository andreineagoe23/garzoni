import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/tokens";
import { journeyNodeIcon, type JourneyNodeModel } from "@garzoni/core";

/** Face diameter of the chunky button. */
const SIZE = 64;
/** Height of the 3D bottom edge. */
const EDGE = 7;
/** Ring padding around the current node. */
const RING_PAD = 14;
const HIT_WIDTH = 96;

type Props = {
  node: JourneyNodeModel;
  index: number;
  motionSimplify: boolean;
  selected: boolean;
  onPress: () => void;
};

/** Gold section-progress ring around the current node. */
function NodeProgressRing({
  size,
  value,
  track,
  active,
}: {
  size: number;
  value: number;
  track: string;
  active: string;
}) {
  const strokeWidth = 5;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={track}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={active}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - clamped)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Gold "continue" pill bouncing above the current node, Duolingo-style. */
function ContinuePill({
  label,
  bg,
  fg,
  motionSimplify,
}: {
  label: string;
  bg: string;
  fg: string;
  motionSimplify: boolean;
}) {
  const bounce = useSharedValue(0);
  useEffect(() => {
    if (motionSimplify) return;
    bounce.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [bounce, motionSimplify]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * bounce.value }],
  }));
  return (
    <View pointerEvents="none" style={styles.pillAnchor}>
      <Animated.View style={[styles.pill, { backgroundColor: bg }, style]}>
        <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

/** Soft expanding halo behind the current node. */
function PulseRing({ size, color }: { size: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * 0.45 }],
    opacity: 0.4 * (1 - t.value),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function JourneyNode({
  node,
  index,
  motionSimplify,
  selected,
  onPress,
}: Props) {
  const { colors: c } = useTheme();
  const { t } = useTranslation("common");

  const isActiveColor = node.state === "done" || node.state === "current";
  const face = isActiveColor ? c.primary : "#33425e";
  const edge = isActiveColor ? c.primaryDark : "#1c2940";
  const dimmed = node.state === "locked";

  const icon = (() => {
    switch (node.state) {
      case "done":
        return (
          <MaterialCommunityIcons name="check-bold" size={28} color="#ffffff" />
        );
      case "current":
        return <MaterialCommunityIcons name="star" size={30} color="#ffffff" />;
      case "locked":
        return (
          <MaterialCommunityIcons name="lock" size={24} color={c.textFaint} />
        );
      default:
        return (
          <MaterialCommunityIcons
            name={
              journeyNodeIcon(
                node.course,
              ) as keyof typeof MaterialCommunityIcons.glyphMap
            }
            size={24}
            color="rgba(255,255,255,0.65)"
          />
        );
    }
  })();

  const sectionsValue = node.metrics.percent / 100;

  const outer = SIZE + (node.state === "current" ? RING_PAD : 0);
  const pos = {
    left: node.x - HIT_WIDTH / 2,
    top: node.y - (outer + EDGE) / 2,
  };

  // Face sinks onto its edge while pressed — chunky arcade-button feel.
  const sink = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.value }],
  }));

  const body = (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        sink.value = withTiming(EDGE - 2, { duration: 70 });
        if (Platform.OS !== "web") void Haptics.selectionAsync();
      }}
      onPressOut={() => {
        sink.value = withTiming(0, { duration: 120 });
      }}
      hitSlop={6}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel={node.course.title}
    >
      {node.state === "current" && !motionSimplify ? (
        <PulseRing size={outer + 8} color={c.primary} />
      ) : null}

      {/* Ground shadow anchoring the node to the trail */}
      <View
        pointerEvents="none"
        style={[
          styles.groundShadow,
          { top: (outer - SIZE) / 2 + SIZE + EDGE - 6 },
        ]}
      />

      <View
        style={{
          width: outer,
          height: outer + EDGE,
          alignItems: "center",
          opacity: dimmed ? 0.6 : 1,
        }}
      >
        {/* Progress ring (current only) */}
        {node.state === "current" ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <NodeProgressRing
              size={outer}
              value={Math.max(0.05, sectionsValue)}
              track={`${c.accent}33`}
              active={c.accent}
            />
          </View>
        ) : null}

        {/* 3D edge */}
        <View
          style={[
            styles.circle,
            {
              left: (outer - SIZE) / 2,
              top: (outer - SIZE) / 2 + EDGE,
              backgroundColor: edge,
            },
          ]}
        />
        {/* Face */}
        <Animated.View
          style={[
            styles.circle,
            {
              left: (outer - SIZE) / 2,
              top: (outer - SIZE) / 2,
              backgroundColor: face,
              borderWidth: selected ? 3 : 0,
              borderColor: "#ffffff",
            },
            faceStyle,
          ]}
        >
          {icon}
        </Animated.View>
      </View>

      {node.state === "current" ? (
        <ContinuePill
          label={t("journey.continuePill", { defaultValue: "CONTINUE" })}
          bg={c.accent}
          fg="#1a1a1a"
          motionSimplify={motionSimplify}
        />
      ) : null}

      {/* Earned stars under completed nodes */}
      {node.state === "done" ? (
        <View
          pointerEvents="none"
          style={[
            styles.starRow,
            { top: (outer - SIZE) / 2 + SIZE + EDGE + 4 },
          ]}
        >
          <MaterialCommunityIcons name="star" size={11} color={c.accent} />
          <MaterialCommunityIcons
            name="star"
            size={14}
            color={c.accent}
            style={{ marginTop: -2 }}
          />
          <MaterialCommunityIcons name="star" size={11} color={c.accent} />
        </View>
      ) : null}
    </Pressable>
  );

  if (motionSimplify) {
    return <View style={[styles.positioned, pos]}>{body}</View>;
  }
  return (
    <Animated.View
      style={[styles.positioned, pos]}
      entering={FadeInDown.springify()
        .damping(16)
        .stiffness(180)
        .delay(Math.min(index * 50, 400))}
    >
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  positioned: {
    position: "absolute",
  },
  hit: {
    width: HIT_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pillAnchor: {
    position: "absolute",
    top: -26,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: "#9a7b0a",
  },
  pillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  groundShadow: {
    position: "absolute",
    width: 66,
    height: 13,
    borderRadius: 7,
    left: (HIT_WIDTH - 66) / 2,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  starRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 1,
  },
});
