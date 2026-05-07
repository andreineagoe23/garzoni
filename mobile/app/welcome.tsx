import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import Svg, {
  Path,
  Circle,
  Ellipse,
  Rect,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { Stack, router } from "expo-router";
import { authLogoWhiteRectangularUrl } from "@garzoni/core";
import { brand } from "../src/theme/brand";
import { setWelcomeSeen } from "../src/auth/firstRunFlags";

// ─── Design tokens (dark luxury — kept local, always dark) ──────────────────
const C = {
  bg: brand.bgDark,
  bgDeep: "#070a0e",
  surface: brand.bgCard,
  surfaceRaised: "#161f2e",
  primary: brand.green,
  primaryBright: "#2a7347",
  primarySoft: "rgba(29,83,48,0.18)",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
};

// ─── Slide copy ─────────────────────────────────────────────────────────────
type SlideCopy = {
  id: "streak" | "tools" | "plans";
  eyebrow: string;
  headline: ReactNode;
  sub: string;
  cta: string;
};

const EM = (w: string) => (
  <Text style={{ fontStyle: "italic", color: C.goldWarm, fontWeight: "400" }}>
    {w}
  </Text>
);

const SLIDES: SlideCopy[] = [
  {
    id: "streak",
    eyebrow: "Daily practice",
    headline: <Text>Learn finance that {EM("actually sticks")}</Text>,
    sub: "Build streaks, earn XP, and progress through guided lessons designed for daily momentum.",
    cta: "Continue",
  },
  {
    id: "tools",
    eyebrow: "Your toolkit",
    headline: <Text>AI-powered tools {EM("for your money")}</Text>,
    sub: "Use calculators, simulations, and guided insights to practice smarter decisions with confidence.",
    cta: "Continue",
  },
  {
    id: "plans",
    eyebrow: "Start anywhere",
    headline: <Text>{EM("Start free.")} Upgrade when it fits.</Text>,
    sub: "Tap a plan to see what you unlock. Starter is free forever.",
    cta: "Get started",
  },
];

// ─── Radial glow helper (SVG, so fade actually fades) ──────────────────────
type GlowProps = {
  width: number;
  height: number;
  color: string;
  opacity?: number;
  stopFar?: number; // 0-1, where transparent stop lands
  shape?: "circle" | "ellipse";
  style?: object;
};
function Glow({
  width,
  height,
  color,
  opacity = 1,
  stopFar = 0.7,
  shape = "circle",
  style,
}: GlowProps) {
  const id = `g-${Math.round(width)}-${Math.round(height)}-${color.length}`;
  return (
    <Svg
      width={width}
      height={height}
      style={style as never}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop
            offset={`${stopFar * 100}%`}
            stopColor={color}
            stopOpacity={0}
          />
        </RadialGradient>
      </Defs>
      {shape === "circle" ? (
        <Circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2}
          fill={`url(#${id})`}
        />
      ) : (
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={`url(#${id})`}
        />
      )}
    </Svg>
  );
}

// ─── Slide 1: streak card stack ─────────────────────────────────────────────
function SlideStreak() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const streakIdx = 2;
  return (
    <View style={s.streakWrap}>
      <View style={s.glowAbs} pointerEvents="none">
        <Glow
          width={340}
          height={340}
          color={C.primary}
          opacity={0.28}
          stopFar={0.6}
        />
      </View>
      <View style={s.backLessonCard}>
        <View style={s.lessonBadge}>
          <Text style={s.lessonBadgeText}>02</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrowMini}>LESSON 2 · 4 MIN</Text>
          <Text style={s.lessonTitle}>Interest that compounds</Text>
        </View>
      </View>
      <View style={s.heroCard}>
        <View style={s.heroRowTop}>
          <View style={s.inlineRow}>
            <View style={s.goldDot} />
            <Text style={s.heroLabel}>CURRENT STREAK</Text>
          </View>
          <Text style={s.dayCount}>Day 3</Text>
        </View>
        <View style={s.xpRow}>
          <Text style={s.xpValue}>120</Text>
          <Text style={s.xpUnit}>XP</Text>
        </View>
        <View style={s.streakStrip}>
          {days.map((d, i) => {
            const done = i < streakIdx;
            const today = i === streakIdx;
            const future = i > streakIdx;
            return (
              <View key={`${d}-${i}`} style={s.streakCell}>
                <View
                  style={[
                    s.streakPip,
                    {
                      backgroundColor: today
                        ? C.primary
                        : done
                          ? C.primarySoft
                          : "transparent",
                      borderColor: today
                        ? C.primaryBright
                        : done
                          ? "rgba(42,115,71,0.4)"
                          : C.borderSoft,
                    },
                  ]}
                >
                  {done ? (
                    <Svg width={12} height={12} viewBox="0 0 12 12">
                      <Path
                        d="M2 6l3 3 5-6"
                        stroke={C.primaryBright}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  ) : today ? (
                    <View style={s.goldPip} />
                  ) : null}
                </View>
                <Text
                  style={[
                    s.streakDayLabel,
                    {
                      color: today ? C.text : future ? C.faint : C.muted,
                      fontWeight: today ? "600" : "400",
                    },
                  ]}
                >
                  {d}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Slide 2: layered tool cards ────────────────────────────────────────────
function SlideTools() {
  return (
    <View style={s.toolsWrap}>
      <View style={s.glowAbsCenter} pointerEvents="none">
        <Glow
          width={320}
          height={320}
          color={C.primary}
          opacity={0.3}
          stopFar={0.65}
        />
      </View>
      <View style={s.toolBackLeft}>
        <Text style={s.eyebrowMini}>SIMULATOR</Text>
        <Text style={s.toolSubTitle}>Debt payoff</Text>
        <View style={s.barsRow}>
          {[14, 22, 18, 26, 20, 14, 8, 4].map((h, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                marginHorizontal: 1,
                backgroundColor: i < 4 ? C.primary : C.primarySoft,
                borderRadius: 2,
              }}
            />
          ))}
        </View>
      </View>
      <View style={s.toolBackRight}>
        <Text style={s.eyebrowMini}>PROJECTION</Text>
        <Text style={s.toolSubTitle}>10-year savings</Text>
        <Svg width={88} height={24} viewBox="0 0 88 24">
          <Path
            d="M0 18 Q12 16 20 12 T40 8 T60 6 T88 2"
            stroke={C.primaryBright}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M0 18 Q12 16 20 12 T40 8 T60 6 T88 2 L88 24 L0 24 Z"
            fill={C.primaryBright}
            opacity={0.12}
          />
        </Svg>
      </View>
      <View style={s.toolFront}>
        <View style={s.heroRowTop}>
          <Text style={s.eyebrowMini}>CALCULATOR</Text>
          <View style={s.aiChip}>
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Path
                d="M5 0l1.2 3.3L10 5l-3.8 1.7L5 10l-1.2-3.3L0 5l3.8-1.7z"
                fill={C.primaryBright}
              />
            </Svg>
            <Text style={s.aiChipText}>AI</Text>
          </View>
        </View>
        <Text style={s.italicMuted}>Monthly budget</Text>
        <Text style={s.bigNumber}>$2,840</Text>
        <View style={s.segRow}>
          <View
            style={{ flex: 42, backgroundColor: C.primaryBright, height: 6 }}
          />
          <View
            style={{
              flex: 28,
              backgroundColor: C.goldWarm,
              opacity: 0.7,
              height: 6,
              marginHorizontal: 2,
            }}
          />
          <View style={{ flex: 30, backgroundColor: C.ghost, height: 6 }} />
        </View>
        <View style={s.segLabels}>
          <Text style={s.segLabel}>Needs 42%</Text>
          <Text style={s.segLabel}>Wants 28%</Text>
          <Text style={s.segLabel}>Save 30%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Slide 3: plan tiers (clickable) ────────────────────────────────────────
type TierId = "starter" | "plus" | "pro";
const TIERS: Array<{
  id: TierId;
  name: string;
  tag: string;
  gold: boolean;
  perks: string[];
}> = [
  {
    id: "starter",
    name: "Starter",
    tag: "Free forever",
    gold: false,
    perks: [
      "Core lessons & daily streaks",
      "Basic XP, coins, and badges",
      "Leaderboards and missions",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tag: "Personalised path",
    gold: false,
    perks: [
      "Tailored learning path",
      "Expanded lesson library",
      "Priority AI tutor chats",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tag: "Full toolkit",
    gold: true,
    perks: [
      "Full financial toolkit",
      "Advanced simulations & analytics",
      "Early access to new tools",
    ],
  },
];

function SlidePlans() {
  const [selected, setSelected] = useState<TierId>("pro");
  const active = TIERS.find((t) => t.id === selected) ?? TIERS[2];
  return (
    <View style={s.plansOuter}>
      <View style={s.goldGlowAbs} pointerEvents="none">
        <Glow
          width={340}
          height={240}
          color={C.goldWarm}
          opacity={0.22}
          stopFar={0.7}
          shape="ellipse"
        />
      </View>
      <View style={s.tiersCol}>
        {TIERS.map((t) => {
          const isSel = t.id === selected;
          const isPro = t.gold;
          return (
            <Pressable
              key={t.id}
              onPress={() => setSelected(t.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t.name} plan`}
              style={[
                s.tierRow,
                {
                  backgroundColor: isPro ? "rgba(230,200,122,0.08)" : C.surface,
                  borderColor: isSel
                    ? isPro
                      ? C.goldWarm
                      : C.primaryBright
                    : isPro
                      ? C.goldWarm
                      : C.border,
                  transform: [{ scale: isSel ? 1.03 : 1 }],
                },
              ]}
            >
              <View style={s.tierLeft}>
                <View
                  style={[
                    s.tierDot,
                    {
                      backgroundColor: isPro ? C.gold : C.ghost,
                    },
                  ]}
                />
                <View>
                  <Text
                    style={[s.tierName, { color: isPro ? C.goldWarm : C.text }]}
                  >
                    {t.name}
                  </Text>
                  {isPro ? (
                    <Text style={s.tierRecommended}>RECOMMENDED</Text>
                  ) : null}
                </View>
              </View>
              <Text
                style={[
                  s.tierTag,
                  isPro && { fontStyle: "italic", color: C.goldWarm },
                ]}
              >
                {t.tag}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.perksCol}>
        {active.perks.map((perk) => (
          <View key={perk} style={s.perkRow}>
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Circle cx={7} cy={7} r={7} fill={C.primarySoft} />
              <Path
                d="M4 7.2l2 2 4-4.5"
                stroke={C.primaryBright}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={s.perkText}>{perk}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Cloudinary wordmark (logo on slide 1 only) ─────────────────────────────
function WelcomeLogo({ large = false }: { large?: boolean }) {
  const uri = authLogoWhiteRectangularUrl({ width: 560 });
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <Text
        style={{
          fontSize: 28,
          color: C.text,
          fontWeight: "600",
          letterSpacing: -0.3,
        }}
      >
        Garzoni
      </Text>
    );
  }
  return (
    <Image
      accessibilityLabel="Garzoni"
      source={{ uri }}
      style={{
        width: large ? 220 : 180,
        height: large ? 56 : 44,
      }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<SlideCopy>>(null);
  const [idx, setIdx] = useState(0);

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 70 }),
    [],
  );
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const n = viewableItems[0]?.index;
      if (typeof n === "number") setIdx(n);
    },
  ).current;

  const last = idx === SLIDES.length - 1;
  const slide = SLIDES[idx];

  const markSeenAndGo = async (href: "/login" | "/register") => {
    await setWelcomeSeen();
    router.replace(href);
  };

  const onContinue = () => {
    if (last) {
      void markSeenAndGo("/register");
      return;
    }
    listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
  };

  const renderHero = (id: SlideCopy["id"]) => {
    if (id === "streak") return <SlideStreak />;
    if (id === "tools") return <SlideTools />;
    return <SlidePlans />;
  };

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.ambientTop} pointerEvents="none">
        <Glow
          width={460}
          height={320}
          color={C.primary}
          opacity={0.18}
          stopFar={0.55}
          shape="ellipse"
        />
      </View>
      <View style={s.ambientBottom} pointerEvents="none">
        <Glow
          width={360}
          height={260}
          color={C.goldWarm}
          opacity={0.06}
          stopFar={0.5}
          shape="ellipse"
        />
      </View>

      <View style={s.topBar}>
        <WelcomeLogo large />
        <Pressable onPress={() => void markSeenAndGo("/login")} hitSlop={10}>
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <View style={s.heroSlot}>{renderHero(item.id)}</View>
            <View style={s.copyBlock}>
              <Text style={s.eyebrow}>{item.eyebrow.toUpperCase()}</Text>
              <Text style={s.headline}>{item.headline}</Text>
              <Text style={s.sub}>{item.sub}</Text>
            </View>
          </View>
        )}
      />

      <View style={s.dots}>
        {SLIDES.map((_, i) => {
          const a = i === idx;
          return (
            <View
              key={i}
              style={[
                s.dot,
                {
                  width: a ? 22 : 6,
                  backgroundColor: a ? C.primaryBright : C.ghost,
                },
                a && s.dotActiveGlow,
              ]}
            />
          );
        })}
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={onContinue}
          style={s.cta}
          accessibilityRole="button"
        >
          <Svg style={StyleSheet.absoluteFill as never} pointerEvents="none">
            <Defs>
              <LinearGradient id="ctaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={C.primaryBright} stopOpacity={1} />
                <Stop offset="100%" stopColor={C.primary} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#ctaGrad)" />
          </Svg>
          <View style={s.ctaHighlight} pointerEvents="none" />
          <Text style={s.ctaLabel}>{slide.cta}</Text>
        </Pressable>
        <Pressable onPress={() => void markSeenAndGo("/login")} hitSlop={10}>
          <Text style={s.loginLink}>
            Already have an account?{" "}
            <Text style={{ color: C.primaryBright, fontWeight: "600" }}>
              Log in
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  ambientTop: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ambientBottom: {
    position: "absolute",
    bottom: -40,
    right: -60,
  },
  topBar: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  skip: {
    fontSize: 14,
    color: C.faint,
    letterSpacing: 0.2,
    padding: 6,
  },

  slide: { paddingTop: 8, alignItems: "center" },
  heroSlot: {
    width: "100%",
    minHeight: 320,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  copyBlock: { paddingHorizontal: 28, paddingTop: 10, width: "100%" },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: C.faint,
    fontWeight: "500",
    marginBottom: 12,
  },
  headline: {
    fontSize: 34,
    lineHeight: 38,
    color: C.text,
    fontWeight: "500",
    letterSpacing: -0.8,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
    marginTop: 12,
    maxWidth: 340,
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActiveGlow: {
    shadowColor: C.primaryBright,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 14,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  loginLink: { textAlign: "center", fontSize: 13, color: C.muted },

  // streak
  streakWrap: {
    width: "100%",
    alignItems: "center",
    paddingTop: 24,
  },
  glowAbs: {
    position: "absolute",
    top: -20,
    alignSelf: "center",
  },
  backLessonCard: {
    width: 268,
    height: 88,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderSoft,
    marginBottom: -64,
    transform: [{ translateY: 8 }, { rotate: "-3deg" }],
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    opacity: 0.85,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 6,
  },
  lessonBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonBadgeText: {
    fontSize: 18,
    fontStyle: "italic",
    fontWeight: "600",
    color: C.primaryBright,
  },
  eyebrowMini: {
    fontSize: 10,
    color: C.faint,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  lessonTitle: { fontSize: 14, color: C.text, fontWeight: "500" },
  heroCard: {
    width: 296,
    borderRadius: 26,
    backgroundColor: C.surfaceRaised,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 30 },
    elevation: 10,
  },
  heroRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  goldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
  },
  heroLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: C.muted,
    fontWeight: "500",
  },
  dayCount: {
    fontSize: 14,
    fontStyle: "italic",
    color: C.goldWarm,
    fontWeight: "500",
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 22,
  },
  xpValue: {
    fontSize: 64,
    lineHeight: 64,
    color: C.text,
    fontWeight: "300",
    letterSpacing: -2,
  },
  xpUnit: {
    fontSize: 12,
    letterSpacing: 1,
    color: C.muted,
    marginBottom: 10,
  },
  streakStrip: { flexDirection: "row", gap: 6 },
  streakCell: { flex: 1, alignItems: "center", gap: 6 },
  streakPip: {
    width: "100%",
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  goldPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  streakDayLabel: { fontSize: 10, letterSpacing: 0.4 },

  // tools
  toolsWrap: {
    width: "100%",
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  glowAbsCenter: {
    position: "absolute",
    alignSelf: "center",
  },
  toolBackLeft: {
    position: "absolute",
    width: 164,
    height: 108,
    left: "14%",
    top: "22%",
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    transform: [{ rotate: "-8deg" }],
    opacity: 0.82,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4,
  },
  toolBackRight: {
    position: "absolute",
    width: 164,
    height: 108,
    right: "14%",
    top: "22%",
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    transform: [{ rotate: "7deg" }],
    opacity: 0.82,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4,
  },
  toolFront: {
    width: 224,
    borderRadius: 22,
    backgroundColor: C.surfaceRaised,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 26 },
    elevation: 12,
  },
  toolSubTitle: {
    fontSize: 13,
    color: C.text,
    fontWeight: "500",
    marginBottom: 8,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 32,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(42,115,71,0.35)",
  },
  aiChipText: {
    fontSize: 10,
    color: C.primaryBright,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  italicMuted: {
    fontStyle: "italic",
    color: C.muted,
    fontSize: 14,
    marginBottom: 4,
  },
  bigNumber: {
    fontSize: 40,
    color: C.text,
    fontWeight: "400",
    letterSpacing: -1,
    marginBottom: 14,
  },
  segRow: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  segLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  segLabel: { fontSize: 10, color: C.muted, letterSpacing: 0.3 },

  // plans
  plansOuter: { width: "100%", alignItems: "center", paddingTop: 8 },
  goldGlowAbs: {
    position: "absolute",
    bottom: -30,
    alignSelf: "center",
  },
  tiersCol: { width: 300, gap: 10 },
  tierRow: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierName: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  tierRecommended: {
    fontSize: 10,
    letterSpacing: 1,
    color: C.goldWarm,
    marginTop: 2,
    opacity: 0.75,
  },
  tierTag: { fontSize: 12, color: C.muted },

  perksCol: {
    width: 300,
    marginTop: 10,
    gap: 7,
    paddingLeft: 4,
  },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkText: { fontSize: 13, color: C.muted },
});

// Silence unused svg imports when building static extraction bundles
void Ellipse;
void Rect;
