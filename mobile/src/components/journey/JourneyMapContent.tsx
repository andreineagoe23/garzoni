import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  buildProgressByCourse,
  derivePersonalizedPathState,
  fetchPersonalizedPath,
  fetchProgressSummary,
  postPersonalizedPathRefresh,
  queryKeys,
  staleTimes,
  type MascotType,
  type PersonalizedPathCourse,
  type ProgressSummary,
} from "@garzoni/core";
import { href } from "../../navigation/href";
import { navigateToExercisesFromDashboardSkill } from "../../hooks/useDashboardSkillExercisesNavigation";
import { useAuthSession } from "../../auth/AuthContext";
import { useMascotMotionSimplify } from "../../hooks/useMascotMotionSimplify";
import { useTheme } from "../../theme/ThemeContext";
import { radius, spacing, typography, shadows } from "../../theme/tokens";
import GlassButton from "../ui/GlassButton";
import GlassCard from "../ui/GlassCard";
import { Skeleton } from "../ui";
import {
  buildJourneyLayout,
  remainingMinutes,
  type JourneyDecorationKind,
  type JourneyNodeModel,
} from "@garzoni/core";
import JourneyBackdrop from "./JourneyBackdrop";
import JourneyNode from "./JourneyNode";
import JourneyTrail from "./JourneyTrail";
import {
  CampsiteSprite,
  CloudSprite,
  GrassSprite,
  PeakSprite,
  RockSprite,
  SummitSprite,
  TreasureChestSprite,
  TreeClusterSprite,
  MascotSprite,
  TreeSprite,
} from "./JourneyScenery";

type Props = {
  onCourseClick?: (courseId: number, pathId?: number) => void;
  /** When set, the climb header shows a compact "list view" action. */
  onSwitchToList?: () => void;
  /** When set, the climb header shows a compact "all topics" action. */
  onShowAllTopics?: () => void;
};

/**
 * Onboarding goals sometimes arrive as Python reprs ("['Debt']").
 * Flatten to clean labels.
 */
function cleanGoals(goals: unknown): string[] {
  const list = Array.isArray(goals) ? goals.flat() : [];
  return list
    .filter((g): g is string => typeof g === "string")
    .flatMap((g) => {
      const s = g.trim();
      const inner = s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;
      return inner
        .split(",")
        .map((p) => p.replace(/^[\s'"]+|[\s'"]+$/g, ""))
        .filter(Boolean);
    });
}

function SceneryItem({
  kind,
  size,
  snow,
  variant,
}: {
  kind: JourneyDecorationKind;
  size: number;
  snow: boolean;
  variant: number;
}) {
  switch (kind) {
    case "tree":
      return <TreeSprite height={size} snow={snow} variant={variant} />;
    case "trees":
      return <TreeClusterSprite height={size} snow={snow} variant={variant} />;
    case "peak":
      return <PeakSprite width={size} variant={variant} />;
    case "cloud":
      return <CloudSprite width={size} variant={variant} />;
    case "grass":
      return <GrassSprite height={size} />;
    case "rock":
      return <RockSprite width={size} variant={variant} />;
  }
}

/** Slow lateral drift, like clouds passing the summit. */
function DriftingCloud({
  x,
  y,
  width,
  variant,
  duration,
  motionSimplify,
}: {
  x: number;
  y: number;
  width: number;
  variant: number;
  duration: number;
  motionSimplify: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (motionSimplify) return;
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [t, duration, motionSimplify]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.value - 0.5) * 36 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: x, top: y },
        motionSimplify ? null : style,
      ]}
    >
      <CloudSprite width={width} variant={variant} />
    </Animated.View>
  );
}

const CAMPSITE_W = 140;

/**
 * The summit mountain — a BACKGROUND object filling the snow band. Its base
 * sits where the gravel ends; the trail and nodes draw OVER it, so the last
 * stretch of the climb winds across the mountain's face up to the tip.
 */
function SummitMarker({
  x,
  baseY,
  height,
  accent,
  label,
}: {
  x: number;
  baseY: number;
  height: number;
  accent: string;
  label: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x - 210,
        top: baseY - height - 36,
        width: 420,
        alignItems: "center",
      }}
    >
      <View style={[styles.summitPill, { backgroundColor: accent }]}>
        <Text style={styles.summitPillText}>{label.toUpperCase()}</Text>
      </View>
      <SummitSprite height={height} />
    </View>
  );
}

/** Basecamp clearing — 3D campsite sprite + label. */
function BasecampMarker({
  x,
  y,
  label,
  surface,
  border,
  textMuted,
}: {
  x: number;
  y: number;
  label: string;
  surface: string;
  border: string;
  textMuted: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x - CAMPSITE_W / 2,
        top: y - 8,
        width: CAMPSITE_W,
        alignItems: "center",
      }}
    >
      <CampsiteSprite width={CAMPSITE_W} />
      <View
        style={[
          styles.basecampPill,
          { backgroundColor: surface, borderColor: border },
        ]}
      >
        <Text style={[styles.summitPillText, { color: textMuted }]}>
          {label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/**
 * "The Climb" — personalized path rendered as a Duolingo-style journey map.
 * Basecamp at the bottom, summit (the learner's goal) at the top; locked
 * plan courses sit under fog of war. Node details open in a tap tooltip.
 */
export default function JourneyMapContent({
  onCourseClick,
  onSwitchToList,
  onShowAllTopics,
}: Props) {
  const { t } = useTranslation("common");
  const { colors: c } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const motionSimplify = useMascotMotionSimplify();

  const personalizedQuery = useQuery({
    queryKey: queryKeys.personalizedPath(),
    queryFn: () => fetchPersonalizedPath().then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const progressSummaryQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () =>
      fetchProgressSummary().then((r) => r.data as ProgressSummary),
    enabled: isAuthenticated,
    staleTime: staleTimes.progressSummary,
    // No polling — freshness comes from post-completion invalidation and the
    // once-per-focus refetch below. A background interval here hammered the
    // 582KB personalized-path and made the dashboard spinner self-trigger.
  });

  const refreshMutation = useMutation({
    mutationFn: async () => postPersonalizedPathRefresh(),
    onSuccess: async () => {
      await personalizedQuery.refetch();
    },
    onError: () => {
      Alert.alert("", t("personalizedPath.errors.recommendationsFailed"));
    },
  });

  // Hold the latest refetch closure in a ref so useFocusEffect only fires on
  // actual focus. Depending on the query objects directly re-runs the effect
  // every render (react-query returns new objects each time), which loops:
  // refetch → state change → re-render → new callback → refetch → …
  const refetchOnFocus = useRef<() => void>(() => {});
  refetchOnFocus.current = () => {
    if (!isAuthenticated) return;
    void personalizedQuery.refetch();
    void progressSummaryQuery.refetch();
  };
  useFocusEffect(
    useCallback(() => {
      refetchOnFocus.current();
    }, []),
  );

  const progressByCourse = useMemo(
    () => buildProgressByCourse(progressSummaryQuery.data),
    [progressSummaryQuery.data],
  );

  const { courses, reviewQueue, isPreview, hasCourses } = useMemo(
    () => derivePersonalizedPathState(personalizedQuery.data),
    [personalizedQuery.data],
  );

  // Reserve a band below basecamp for the docked detours strip so the whole
  // scroll stays map — no plain list sections under the scene.
  const detoursBand = reviewQueue.length > 0 ? 104 : 0;
  const layout = useMemo(
    () =>
      buildJourneyLayout(courses, progressByCourse, windowWidth, {
        bottomExtra: detoursBand,
      }),
    [courses, progressByCourse, windowWidth, detoursBand],
  );

  // One mascot per biome band, in a clear pocket beside the trail:
  // bear in the meadow, bull in the forest, owl up in the snow.
  const bandMascots = useMemo(() => {
    const n = layout.nodes.length;
    if (n < 2) {
      return [] as { mascot: MascotType; x: number; y: number; size: number }[];
    }
    const cx = windowWidth / 2;
    const mid = layout.nodes[Math.round((n - 1) * 0.45)];
    const midSide = mid.x >= cx ? 1 : -1;
    // Field (meadow) band: bottom node up to 30% of the climb.
    const climbBottom = layout.nodes[0].y;
    const climbSpan = Math.max(climbBottom - layout.nodes[n - 1].y, 1);
    return [
      {
        mascot: "bear" as MascotType,
        // Middle-left of the field, clear of the trail's left swing.
        x: Math.max(windowWidth * 0.26, 80),
        y: climbBottom - climbSpan * 0.09,
        size: 64,
      },
      {
        mascot: "bull" as MascotType,
        x: Math.min(Math.max(mid.x + midSide * 96, 40), windowWidth - 40),
        y: mid.y + 56,
        size: 66,
      },
      {
        mascot: "owl" as MascotType,
        // Left of the trail so it never sits on the road near the summit.
        x: Math.max(layout.summit.x - 116, 44),
        y: layout.summit.y + 100,
        size: 58,
      },
    ];
  }, [layout, windowWidth]);

  const overall = useMemo(() => {
    const unlocked = layout.nodes.filter((n) => n.state !== "locked");
    if (unlocked.length === 0) {
      return Number(personalizedQuery.data?.meta?.overall_completion ?? 0);
    }
    return Math.round(
      unlocked.reduce((sum, n) => sum + n.metrics.percent, 0) / unlocked.length,
    );
  }, [layout.nodes, personalizedQuery.data?.meta?.overall_completion]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // Locate-button state, NOT raw scrollY: storing scroll offset in state would
  // re-render the whole map (~hundreds of sprites) on every scroll frame.
  // Updates only when the viewport crosses the "away from focus" threshold.
  const [locateDir, setLocateDir] = useState<"up" | "down" | null>(null);
  const locateDirRef = useRef<"up" | "down" | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        personalizedQuery.refetch(),
        progressSummaryQuery.refetch(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [personalizedQuery, progressSummaryQuery]);

  // Land the viewport on the current node (slightly above center).
  const scrollRef = useRef<ScrollView>(null);
  const autoScrolled = useRef(false);
  const mapTopRef = useRef<number | null>(null);
  const focusTargetY =
    layout.currentIndex >= 0
      ? layout.nodes[layout.currentIndex].y
      : layout.summit.y;
  useEffect(() => {
    if (autoScrolled.current || layout.nodes.length === 0) return;
    autoScrolled.current = true;
    // Let the map commit its layout before reading its offset.
    const timer = setTimeout(() => {
      const mapTop = mapTopRef.current ?? 0;
      const y = Math.max(0, mapTop + focusTargetY - windowHeight * 0.45);
      scrollRef.current?.scrollTo({ y, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [layout, windowHeight, focusTargetY]);

  const openCourse = (course: PersonalizedPathCourse) => {
    if (course.locked) {
      // Locked/fog nodes are an endowment paywall surface (3.2).
      router.push(href("/subscriptions?reason=journey"));
      return;
    }
    if (onCourseClick) {
      onCourseClick(course.id, Number(course.path || 0) || undefined);
    } else {
      router.push(`/flow/${course.id}`);
    }
  };

  if (personalizedQuery.isPending) {
    return (
      <View style={{ gap: spacing.md, padding: spacing.md }}>
        <Skeleton width="100%" height={92} borderRadius={radius.lg} />
        <Skeleton width="100%" height={420} borderRadius={radius.lg} />
      </View>
    );
  }

  if (personalizedQuery.isError) {
    return (
      <View style={{ padding: spacing.md }}>
        <GlassCard padding="md">
          <Text style={{ color: c.error, fontSize: typography.sm }}>
            {t("personalizedPath.errors.recommendationsFailed")}
          </Text>
        </GlassCard>
      </View>
    );
  }

  if (!hasCourses) {
    return (
      <View style={{ padding: spacing.md }}>
        <GlassCard padding="md" style={{ gap: spacing.md }}>
          <Text
            style={{
              color: c.text,
              fontSize: typography.sm,
              fontWeight: "800",
            }}
          >
            {t("personalizedPath.title")}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
            {t("personalizedPath.buildingPath")}
          </Text>
          <GlassButton
            variant="primary"
            size="sm"
            loading={refreshMutation.isPending}
            onPress={() => refreshMutation.mutate()}
          >
            {t("personalizedPath.refresh")}
          </GlassButton>
        </GlassCard>
      </View>
    );
  }

  const goalsLine = cleanGoals(
    personalizedQuery.data?.meta?.onboarding_goals,
  ).join(" · ");
  const minutesLeft = remainingMinutes(layout.nodes);
  const hasFog = layout.fogBottomY > 0;

  const currentNode =
    layout.currentIndex >= 0 ? layout.nodes[layout.currentIndex] : null;
  const selectedNode = selectedIdx != null ? layout.nodes[selectedIdx] : null;

  // Floating "find me" button when the viewport drifts away from the action.
  const focusScrollY =
    (mapTopRef.current ?? 0) + focusTargetY - windowHeight * 0.45;

  const nodeActionLabel = (node: JourneyNodeModel) => {
    if (node.course.locked)
      return t("journey.tooltipUnlock", { defaultValue: "Unlock with Plus" });
    if (node.state === "done")
      return t("journey.tooltipReview", { defaultValue: "Review" });
    if (node.metrics.percent > 0)
      return t("journey.tooltipContinue", { defaultValue: "Continue" });
    return t("journey.tooltipStart", { defaultValue: "Start" });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Floating header card — overlays the map, never pushes it down */}
      <View style={styles.headerWrap} pointerEvents="box-none">
        <View
          style={[
            styles.header,
            shadows.md,
            { backgroundColor: c.primary, borderColor: c.primaryDark },
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.headerKicker} numberOfLines={1}>
              {t("journey.headerKicker", { defaultValue: "THE CLIMB" })}
              {goalsLine ? ` · ${goalsLine.toUpperCase()}` : ""}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentNode?.course.title ??
                t("journey.summit", { defaultValue: "Summit" })}
            </Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {t("journey.summitMeta", {
                defaultValue:
                  "{{percent}}% climbed · ~{{minutes}} min to the top",
                percent: overall,
                minutes: minutesLeft,
              })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {onShowAllTopics ? (
              <Pressable
                onPress={onShowAllTopics}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.headerBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel={t("dashboard.nav.allTopics")}
              >
                <MaterialCommunityIcons
                  name="view-grid-outline"
                  size={18}
                  color="#ffffff"
                />
              </Pressable>
            ) : null}
            {onSwitchToList ? (
              <Pressable
                onPress={onSwitchToList}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.headerBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel={t("journey.modeList", {
                  defaultValue: "List",
                })}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={18}
                  color="#ffffff"
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              hitSlop={6}
              style={({ pressed }) => [
                styles.headerBtn,
                { opacity: pressed || refreshMutation.isPending ? 0.6 : 1 },
              ]}
              accessibilityLabel={t("journey.rechart", {
                defaultValue: "Re-chart route",
              })}
            >
              <MaterialCommunityIcons
                name="map-marker-path"
                size={18}
                color="#ffffff"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.sm }}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const away = Math.abs(y - focusScrollY) > windowHeight * 0.7;
          const dir = away ? (y < focusScrollY ? "down" : "up") : null;
          if (dir !== locateDirRef.current) {
            locateDirRef.current = dir;
            setLocateDir(dir);
          }
        }}
        scrollEventThrottle={48}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void onPullRefresh()}
            tintColor={c.primary}
          />
        }
      >
        {/* ——— The map ——— */}
        <View
          style={{ width: windowWidth, height: layout.height }}
          onLayout={(e) => {
            mapTopRef.current = e.nativeEvent.layout.y;
          }}
        >
          {/* The mountain itself: opaque terrain bands the trail is carved into */}
          <JourneyBackdrop
            nodes={layout.nodes}
            width={windowWidth}
            height={layout.height}
            summit={layout.summit}
          />

          {/* Summit mountain — background: trail + nodes draw over its face */}
          <SummitMarker
            x={layout.summitSprite.x}
            baseY={layout.summitSprite.y}
            height={layout.summitSprite.height}
            accent={c.accent}
            label={t("journey.summit", { defaultValue: "Summit" })}
          />

          {/* Winding trail with climbed-so-far progress */}
          <JourneyTrail
            trail={layout.trail}
            width={windowWidth}
            height={layout.height}
            motionSimplify={motionSimplify}
          />

          {/* Mountain scenery, feet planted on the terrain (bottom-center
              anchored; painter-sorted so lower scenery overlaps higher) */}
          {layout.decorations.map((d, i) => (
            <View
              key={`decor-${i}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: d.x - 80,
                top: d.y - d.size,
                width: 160,
                height: d.size,
                alignItems: "center",
                justifyContent: "flex-end",
                opacity: d.opacity,
              }}
            >
              <SceneryItem
                kind={d.kind}
                size={d.size}
                snow={d.snow}
                variant={d.variant}
              />
            </View>
          ))}

          {/* Clouds drifting past the upper slopes */}
          <DriftingCloud
            x={windowWidth * 0.06}
            y={layout.summit.y - 52}
            width={68}
            variant={0}
            duration={6500}
            motionSimplify={motionSimplify}
          />
          <DriftingCloud
            x={windowWidth * 0.74}
            y={layout.summit.y + 18}
            width={50}
            variant={1}
            duration={9000}
            motionSimplify={motionSimplify}
          />
          <DriftingCloud
            x={windowWidth * 0.7}
            y={layout.summit.y - 96}
            width={58}
            variant={0}
            duration={7800}
            motionSimplify={motionSimplify}
          />

          {/* Milestone chests — tappable rewards markers. */}
          {layout.chests.map((chest, i) => (
            <Pressable
              key={`chest-${i}`}
              onPress={() => router.push(href("/rewards"))}
              hitSlop={12}
              style={({ pressed }) => [
                {
                  position: "absolute",
                  left: chest.x - 34,
                  top: chest.y - 38,
                  width: 68,
                  height: 76,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Milestone chest — view rewards"
            >
              {/* Soft circular backplate so the chest reads as a button. */}
              <View
                style={[
                  styles.chestPad,
                  shadows.sm,
                  { backgroundColor: c.surfaceElevated, borderColor: c.border },
                ]}
              />
              <TreasureChestSprite
                height={56}
                opacity={chest.unlocked ? 1 : chest.reached ? 0.95 : 0.7}
              />
            </Pressable>
          ))}

          {/* Nodes */}
          {layout.nodes.map((node, i) => (
            <JourneyNode
              key={node.course.id}
              node={node}
              index={layout.nodes.length - 1 - i}
              motionSimplify={motionSimplify}
              selected={selectedIdx === i}
              onPress={() => setSelectedIdx((v) => (v === i ? null : i))}
            />
          ))}

          {/* Mascots: one fellow climber per biome band (bear → meadow,
              bull → forest, owl → snow), feet planted on the terrain */}
          {bandMascots.map((m) => (
            <View
              key={m.mascot}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: m.x - 60,
                top: m.y - m.size,
                width: 120,
                height: m.size,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <MascotSprite mascot={m.mascot} height={m.size} />
            </View>
          ))}

          {/* Fog of war over locked plan courses */}
          {hasFog ? (
            <Svg
              width={windowWidth}
              height={layout.fogBottomY}
              style={{ position: "absolute", top: 0, left: 0, zIndex: 6 }}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={c.bg} stopOpacity={0.9} />
                  <Stop offset="0.7" stopColor={c.bg} stopOpacity={0.5} />
                  <Stop offset="1" stopColor={c.bg} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={windowWidth}
                height={layout.fogBottomY}
                fill="url(#fog)"
              />
            </Svg>
          ) : null}

          {/* Upsell floats inside the fog instead of a card under the map */}
          {hasFog || (isPreview && personalizedQuery.data?.upgrade_prompt) ? (
            <View
              style={[
                styles.fogUpsell,
                shadows.lg,
                {
                  backgroundColor: c.surfaceElevated,
                  borderColor: c.accent,
                  top: hasFog
                    ? Math.max(120, layout.fogBottomY * 0.4 - 40)
                    : 120,
                },
              ]}
            >
              <Text
                style={{
                  color: c.text,
                  fontSize: typography.xs,
                  textAlign: "center",
                  lineHeight: 18,
                }}
              >
                {personalizedQuery.data?.upgrade_prompt ||
                  t("journey.fogUpsell", {
                    defaultValue:
                      "Part of your route is under fog. Upgrade to unlock the full climb.",
                  })}
              </Text>
              <GlassButton
                variant="primary"
                size="sm"
                onPress={() => router.push(href("/subscriptions?reason=journey"))}
              >
                {t("journey.unlockRoute", { defaultValue: "Unfog route" })}
              </GlassButton>
            </View>
          ) : null}

          {/* Basecamp grove — trees hugging the campsite clearing */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: layout.basecamp.x - 128,
              top: layout.basecamp.y - 40,
            }}
          >
            <TreeClusterSprite height={66} variant={1} />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: layout.basecamp.x + 70,
              top: layout.basecamp.y - 28,
            }}
          >
            <TreeSprite height={52} variant={3} />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: layout.basecamp.x + 116,
              top: layout.basecamp.y + 30,
            }}
          >
            <GrassSprite height={16} />
          </View>

          {/* Basecamp clearing */}
          <BasecampMarker
            x={layout.basecamp.x}
            y={layout.basecamp.y}
            label={t("journey.basecamp", { defaultValue: "Basecamp" })}
            surface={c.surfaceElevated}
            border={c.border}
            textMuted={c.textMuted}
          />

          {/* Detours — docked signpost strip below basecamp */}
          {reviewQueue.length > 0 ? (
            <View style={[styles.detourDock, { top: layout.height - 96 }]}>
              <Text style={[styles.detourLabel, { color: c.textFaint }]}>
                {t("journey.detours", {
                  defaultValue: "Detours — skills to reinforce",
                }).toUpperCase()}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing.sm,
                  paddingHorizontal: spacing.xl,
                }}
              >
                {reviewQueue.map((item, idx) => {
                  const due =
                    !item.due_at || new Date(item.due_at) <= new Date()
                      ? t("personalizedPath.due.now")
                      : null;
                  return (
                    <Pressable
                      key={`${item.skill || "skill"}-${idx}`}
                      onPress={() =>
                        navigateToExercisesFromDashboardSkill(
                          item.skill ?? "",
                          "weak_skill_practice",
                        )
                      }
                      style={({ pressed }) => [
                        styles.chip,
                        shadows.sm,
                        {
                          backgroundColor: c.surface,
                          borderColor: due ? c.accent : c.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="sign-direction"
                        size={13}
                        color={due ? c.accent : c.textMuted}
                      />
                      <Text
                        style={[styles.chipText, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {item.skill}
                      </Text>
                      {due ? (
                        <Text style={[styles.chipDue, { color: c.accent }]}>
                          {due}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Tap-away dismiss layer for the tooltip */}
          {selectedNode ? (
            <Pressable
              style={[StyleSheet.absoluteFillObject, { zIndex: 7 }]}
              onPress={() => setSelectedIdx(null)}
            />
          ) : null}

          {/* Node tooltip */}
          {selectedNode ? (
            <Animated.View
              entering={motionSimplify ? undefined : FadeIn.duration(120)}
              style={[
                styles.tooltip,
                shadows.lg,
                {
                  backgroundColor: c.surfaceElevated,
                  borderColor:
                    selectedNode.state === "current" ? c.accent : c.border,
                  top:
                    selectedNode.y > layout.height - 240
                      ? selectedNode.y - 200
                      : selectedNode.y + 54,
                },
              ]}
            >
              <View
                style={[
                  styles.tooltipArrow,
                  {
                    backgroundColor: c.surfaceElevated,
                    borderColor:
                      selectedNode.state === "current" ? c.accent : c.border,
                    left: Math.min(
                      Math.max(selectedNode.x - spacing.xl - 8, 16),
                      windowWidth - spacing.xl * 2 - 32,
                    ),
                    ...(selectedNode.y > layout.height - 240
                      ? { bottom: -7, borderTopWidth: 0, borderLeftWidth: 0 }
                      : { top: -7, borderBottomWidth: 0, borderRightWidth: 0 }),
                  },
                ]}
              />
              {selectedNode.course.path_title ? (
                <Text style={[styles.kicker, { color: c.primary }]}>
                  {selectedNode.course.path_title}
                </Text>
              ) : null}
              <Text
                style={{
                  color: c.text,
                  fontSize: typography.md,
                  fontWeight: "800",
                }}
                numberOfLines={2}
              >
                {selectedNode.course.title}
              </Text>
              <Text
                style={{ color: c.textMuted, fontSize: typography.xs }}
                numberOfLines={1}
              >
                {selectedNode.metrics.totalSections > 0
                  ? `${selectedNode.metrics.completedSections}/${selectedNode.metrics.totalSections} sections · ~${selectedNode.metrics.estimatedMinutes} min`
                  : `~${selectedNode.metrics.estimatedMinutes} min`}
              </Text>
              {selectedNode.course.reason ? (
                <Text
                  style={{
                    color: c.textMuted,
                    fontSize: typography.xs,
                    lineHeight: 16,
                  }}
                  numberOfLines={2}
                >
                  {selectedNode.course.reason}
                </Text>
              ) : null}
              <GlassButton
                variant="primary"
                size="sm"
                onPress={() => {
                  setSelectedIdx(null);
                  openCourse(selectedNode.course);
                }}
              >
                {nodeActionLabel(selectedNode)}
              </GlassButton>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating "back to current node" button */}
      {locateDir ? (
        <Animated.View
          entering={motionSimplify ? undefined : FadeInDown.duration(150)}
          style={styles.locateWrap}
        >
          <Pressable
            onPress={() =>
              scrollRef.current?.scrollTo({
                y: Math.max(0, focusScrollY),
                animated: true,
              })
            }
            style={({ pressed }) => [
              styles.locateBtn,
              shadows.lg,
              {
                backgroundColor: c.surfaceElevated,
                borderColor: c.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityLabel={t("journey.locate", {
              defaultValue: "Jump to current course",
            })}
          >
            <MaterialCommunityIcons
              name={locateDir === "down" ? "arrow-down" : "arrow-up"}
              size={22}
              color={c.primary}
            />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    position: "absolute",
    top: spacing.xs,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderBottomWidth: 6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerKicker: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: typography.md,
    fontWeight: "800",
  },
  headerMeta: {
    color: "rgba(255,255,255,0.75)",
    fontSize: typography.xs,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chestPad: {
    position: "absolute",
    bottom: 2,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    opacity: 0.55,
  },
  summitPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: "#9a7b0a",
  },
  summitPillText: {
    color: "#1a1a1a",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  basecampPill: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderBottomWidth: 3,
  },
  tooltip: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 6,
    padding: spacing.lg,
    gap: spacing.sm,
    zIndex: 8,
  },
  tooltipArrow: {
    position: "absolute",
    width: 14,
    height: 14,
    borderWidth: 1.5,
    transform: [{ rotate: "45deg" }],
  },
  fogUpsell: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 7,
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 6,
    padding: spacing.lg,
  },
  detourDock: {
    position: "absolute",
    left: 0,
    right: 0,
    gap: spacing.xs,
  },
  detourLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    paddingHorizontal: spacing.xl,
  },
  sectionH: {
    fontSize: typography.sm,
    fontWeight: "800",
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  chipText: {
    fontSize: typography.xs,
    fontWeight: "600",
    flexShrink: 1,
  },
  chipDue: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  locateWrap: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
  },
  locateBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
