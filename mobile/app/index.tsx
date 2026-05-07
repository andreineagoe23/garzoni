import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import {
  Animated,
  Dimensions,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { authLogoWhiteRectangularUrl } from "@garzoni/core";
import { useAuthSession } from "../src/auth/AuthContext";
import { fetchProfile, fetchQuestionnaireProgress } from "@garzoni/core";
import {
  getPlanChosenCache,
  getWelcomeSeen,
  setPlanChosenCache,
} from "../src/auth/firstRunFlags";
import { brand } from "../src/theme/brand";
import { spacing } from "../src/theme/tokens";
import LoadingSpinner from "../src/components/ui/LoadingSpinner";

const { width: SW } = Dimensions.get("window");

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

type OnboardingStatus = "pending" | "done" | "needs_onboarding";
type WelcomeStatus = "pending" | "seen" | "unseen";
type PlanStatus = "pending" | "chosen" | "not_chosen";

function SplashLogo() {
  const uri = authLogoWhiteRectangularUrl({ width: 560 });
  const [failed, setFailed] = useState(false);

  if (failed || !uri) {
    return <Text style={styles.logoFallback}>Garzoni</Text>;
  }

  return (
    <Image
      accessibilityLabel="Garzoni"
      accessibilityRole="image"
      source={{ uri }}
      style={styles.logoImage}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

export default function Index() {
  const { hydrated, accessToken } = useAuthSession();
  const [welcomeStatus, setWelcomeStatus] = useState<WelcomeStatus>("pending");
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("pending");
  const [planStatus, setPlanStatus] = useState<PlanStatus>("pending");

  const [showSpinner, setShowSpinner] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse the logo gently while loading
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Delay spinner so fast loads feel instant
  useEffect(() => {
    const id = setTimeout(() => setShowSpinner(true), 400);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    if (!accessToken) {
      void (async () => {
        const seen = await getWelcomeSeen();
        if (!cancelled) {
          setWelcomeStatus(seen ? "seen" : "unseen");
          setOnboardingStatus("done");
          setPlanStatus("chosen");
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const progress = await withTimeout(fetchQuestionnaireProgress(), 8000);
        if (cancelled) return;
        const needsOnboarding = progress.status !== "completed";
        setOnboardingStatus(needsOnboarding ? "needs_onboarding" : "done");
        if (needsOnboarding) {
          setPlanStatus("chosen");
          return;
        }
      } catch {
        if (!cancelled) setOnboardingStatus("done");
      }

      try {
        const planCached = await getPlanChosenCache();
        if (cancelled) return;
        if (planCached) {
          setPlanStatus("chosen");
          return;
        }
        const profile = (await withTimeout(fetchProfile(), 8000)).data;
        const chosen =
          Boolean(profile.subscription_plan_id) ||
          Boolean(
            (
              profile.user_data as
                | { subscription_plan_id?: string | null }
                | undefined
            )?.subscription_plan_id,
          );
        setPlanStatus(chosen ? "chosen" : "not_chosen");
        await setPlanChosenCache();
      } catch {
        if (!cancelled) {
          // Don't trap users in startup loop on transient profile failures.
          setPlanStatus("chosen");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  if (
    !hydrated ||
    (!accessToken && welcomeStatus === "pending") ||
    (accessToken &&
      (onboardingStatus === "pending" || planStatus === "pending"))
  ) {
    return (
      <SafeAreaView style={styles.root}>
        {/* Ambient green glow top-center */}
        <View style={styles.glowTop} pointerEvents="none">
          <Svg width={SW} height={320} pointerEvents="none">
            <Defs>
              <RadialGradient id="gTop" cx="50%" cy="40%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={brand.green} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={brand.green} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={SW / 2} cy={128} r={SW * 0.55} fill="url(#gTop)" />
          </Svg>
        </View>

        {/* Logo centered with pulse */}
        <View style={styles.center}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <SplashLogo />
          </Animated.View>

          <View style={styles.spinnerSlot}>
            {showSpinner && (
              <LoadingSpinner size="sm" color="rgba(229,231,235,0.45)" />
            )}
          </View>
        </View>

        {/* Subtle gold glow bottom */}
        <View style={styles.glowBottom} pointerEvents="none">
          <Svg width={SW} height={200} pointerEvents="none">
            <Defs>
              <RadialGradient id="gBot" cx="50%" cy="60%" rx="50%" ry="50%">
                <Stop
                  offset="0%"
                  stopColor={brand.goldWarm}
                  stopOpacity={0.07}
                />
                <Stop
                  offset="100%"
                  stopColor={brand.goldWarm}
                  stopOpacity={0}
                />
              </RadialGradient>
            </Defs>
            <Circle cx={SW / 2} cy={100} r={SW * 0.45} fill="url(#gBot)" />
          </Svg>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return <Redirect href={welcomeStatus === "seen" ? "/login" : "/welcome"} />;
  }

  if (onboardingStatus === "needs_onboarding") {
    return <Redirect href="/onboarding" />;
  }

  if (planStatus === "not_chosen") {
    return <Redirect href="/subscriptions?onboarding=true" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.bgDark,
  },
  glowTop: {
    position: "absolute",
    top: -40,
    left: 0,
    right: 0,
  },
  glowBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    height: 52,
    width: SW * 0.55,
    maxWidth: 280,
  },
  logoFallback: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: brand.text,
  },
  spinnerSlot: {
    height: 32,
    marginTop: spacing.xxl,
    justifyContent: "center",
    alignItems: "center",
  },
});
