import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { Animated, Dimensions, Image, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useAuthSession } from "../src/auth/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchProfile,
  fetchQuestionnaireProgress,
  queryKeys,
} from "@garzoni/core";
import {
  getPlanChosenCache,
  getWelcomeSeen,
  setPlanChosenCache,
} from "../src/auth/firstRunFlags";
import { brand } from "../src/theme/brand";
import LoadingSpinner from "../src/components/ui/LoadingSpinner";
import { href } from "../src/navigation/href";
import { getPushPermissionStatus } from "../src/bootstrap/pushNotificationsMobile";
import {
  hasAskedForPush,
  isPushPromptDue,
} from "../src/bootstrap/pushPromptState";

const { width: SW } = Dimensions.get("window");
const LOGO = require("../assets/garzoni-logo-white.png");
/** Keep in step with SPLASH_LOGO_WIDTH in app.config.js. */
const LAUNCH_LOGO_SIZE = 150;

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
type PushPromptStatus = "pending" | "not_needed" | "needed";

/**
 * Users who signed up on the web and later installed the app skip mobile
 * onboarding entirely, so they never saw the push priming screen. Show it once,
 * and only when the OS has not made up its mind yet — a granted or hard-denied
 * permission has nothing left to prime.
 */
async function resolvePushPromptStatus(): Promise<PushPromptStatus> {
  try {
    if (await hasAskedForPush()) return "not_needed";
    // Earned, not automatic: the ask waits until the user has finished a lesson.
    // Onboarding used to spend iOS's one-shot dialog before anyone had seen a
    // single lesson, which is why so few devices ever registered.
    if (!(await isPushPromptDue())) return "not_needed";
    const status = await getPushPermissionStatus();
    return status === "undetermined" ? "needed" : "not_needed";
  } catch {
    return "not_needed";
  }
}

export default function Index() {
  const { hydrated, accessToken } = useAuthSession();
  const queryClient = useQueryClient();
  const [welcomeStatus, setWelcomeStatus] = useState<WelcomeStatus>("pending");
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("pending");
  const [planStatus, setPlanStatus] = useState<PlanStatus>("pending");
  const [pushPromptStatus, setPushPromptStatus] =
    useState<PushPromptStatus>("pending");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount so transition from native splash isn't a hard cut
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
          setPushPromptStatus("not_needed");
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      // This gates the splash for every authenticated cold start, so it gets the
      // same timeout treatment as the other boot probes — a hung native
      // permissions call must never strand the user on the loading screen.
      const pushPrompt = await withTimeout(
        resolvePushPromptStatus(),
        3000,
      ).catch<PushPromptStatus>(() => "not_needed");
      if (!cancelled) setPushPromptStatus(pushPrompt);
    })();

    void (async () => {
      // The plan cache is a local read, so consult it BEFORE anything hits the
      // network: it decides whether the profile call is needed at all. Previously
      // the questionnaire call was awaited first and the profile call only started
      // afterwards, making two independent requests strictly serial — a full extra
      // round trip (up to 8s of timeout budget) on the splash for every
      // authenticated cold start that had no cached plan.
      const planCached = await getPlanChosenCache();
      if (cancelled) return;

      const progressPromise = withTimeout(fetchQuestionnaireProgress(), 8000);
      // Fired in parallel, not awaited yet. Skipped entirely when the cache
      // already answers the question, so this adds no request for returning users.
      const profilePromise = planCached
        ? null
        : withTimeout(fetchProfile(), 8000).catch(() => null);

      try {
        const progress = await progressPromise;
        if (cancelled) return;
        // Hand the result to React Query so the dashboard and learn tab reuse it
        // instead of re-requesting the same endpoint seconds later. These boot
        // probes are raw apiClient calls, so without this they never reached the
        // cache and every app open paid for the same data twice.
        queryClient.setQueryData(queryKeys.questionnaireProgress(), progress);
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
        if (cancelled) return;
        if (planCached) {
          setPlanStatus("chosen");
          return;
        }
        const profileRes = await profilePromise;
        if (cancelled) return;
        if (!profileRes) throw new Error("profile unavailable");
        const profile = profileRes.data;
        queryClient.setQueryData(queryKeys.profile(), profile);
        const chosen =
          Boolean(profile.subscription_plan_id) ||
          Boolean(
            (
              profile.user_data as
                { subscription_plan_id?: string | null } | undefined
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
  }, [hydrated, accessToken, queryClient]);

  if (
    !hydrated ||
    (!accessToken && welcomeStatus === "pending") ||
    (accessToken &&
      (onboardingStatus === "pending" ||
        planStatus === "pending" ||
        pushPromptStatus === "pending"))
  ) {
    return (
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        <SafeAreaView style={styles.root}>
          {/* Ambient green glow top-center */}
          <View style={styles.glowTop} pointerEvents="none">
            <Svg width={SW} height={320} pointerEvents="none">
              <Defs>
                <RadialGradient id="gTop" cx="50%" cy="40%" rx="50%" ry="50%">
                  <Stop
                    offset="0%"
                    stopColor={brand.green}
                    stopOpacity={0.35}
                  />
                  <Stop offset="100%" stopColor={brand.green} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={SW / 2} cy={128} r={SW * 0.55} fill="url(#gTop)" />
            </Svg>
          </View>

          {/* Logo + spinner centered */}
          <View style={styles.center}>
            <Image
              source={LOGO}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Garzoni"
            />
            <LoadingSpinner size="sm" color="rgba(229,231,235,0.45)" />
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
      </Animated.View>
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

  if (pushPromptStatus === "needed") {
    return <Redirect href={href("/push-prompt")} />;
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
    gap: 28,
  },
  logo: {
    // Same width the native splash uses (SPLASH_LOGO_WIDTH in app.config.js).
    // It was SW*0.28 capped at 120 while iOS drew a full-screen wordmark, so a
    // single cold start showed the same mark at two very different sizes.
    width: LAUNCH_LOGO_SIZE,
    height: LAUNCH_LOGO_SIZE,
  },
});
