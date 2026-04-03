import { router } from "expo-router";

/** Navigate after Google/Apple sign-in using backend `next` (e.g. onboarding for new users). */
export function replaceAfterSocialAuth(next?: string) {
  const raw = (next ?? "").trim().toLowerCase().replace(/^\//, "");
  if (raw === "onboarding") {
    router.replace("/onboarding");
    return;
  }
  router.replace("/(tabs)");
}
