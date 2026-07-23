import { useCallback } from "react";
import { router, Stack } from "expo-router";
import PushPromptScreen from "../src/components/onboarding/PushPromptScreen";
import { markAskedForPush } from "../src/bootstrap/pushPromptState";

/**
 * Standalone priming screen for users who never passed through mobile
 * onboarding — signed up on the web, then installed the app. They used to reach
 * the tabs directly and the only thing that ever asked for permission was the
 * background re-registration hook, firing a cold system dialog at an arbitrary
 * moment (or, once that stopped prompting, never asking at all).
 */
export default function PushPromptRoute() {
  const handleComplete = useCallback(() => {
    void markAskedForPush();
    router.replace("/(tabs)");
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <PushPromptScreen onComplete={handleComplete} />
    </>
  );
}
