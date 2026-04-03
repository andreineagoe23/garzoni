import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthSession } from "../src/auth/AuthContext";
import { fetchQuestionnaireProgress } from "@monevo/core";
import { colors } from "../src/theme/tokens";

type OnboardingStatus = "pending" | "done" | "needs_onboarding";

export default function Index() {
  const { hydrated, accessToken } = useAuthSession();
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("pending");

  useEffect(() => {
    if (!hydrated || !accessToken) return;
    void (async () => {
      try {
        const progress = await fetchQuestionnaireProgress();
        setOnboardingStatus(
          progress.status === "completed" ? "done" : "needs_onboarding"
        );
      } catch {
        // If endpoint missing / error → don't block; go straight to app
        setOnboardingStatus("done");
      }
    })();
  }, [hydrated, accessToken]);

  if (!hydrated || (accessToken && onboardingStatus === "pending")) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  if (onboardingStatus === "needs_onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
});
