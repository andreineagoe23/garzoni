import { router } from "expo-router";

/** Route social sign-ins through root gate for consistent post-auth flow. */
export function replaceAfterSocialAuth(next?: string) {
  void next; // Root gate decides onboarding/subscriptions/tabs.
  router.replace("/");
}
