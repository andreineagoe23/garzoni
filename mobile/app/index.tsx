import { useEffect, useMemo, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthSession } from "../src/auth/AuthContext";
import { fetchProfile, fetchQuestionnaireProgress } from "@garzoni/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import {
  getPlanChosenCache,
  getWelcomeSeen,
  setPlanChosenCache,
} from "../src/auth/firstRunFlags";

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

export default function Index() {
  const { hydrated, accessToken } = useAuthSession();
  const c = useThemeColors();
  const [welcomeStatus, setWelcomeStatus] = useState<WelcomeStatus>("pending");
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("pending");
  const [planStatus, setPlanStatus] = useState<PlanStatus>("pending");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        centered: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: c.bg,
        },
      }),
    [c],
  );

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
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
