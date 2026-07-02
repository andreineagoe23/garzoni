import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";

/** Apple App Store id + Android package, for the store-listing fallback. */
const APP_STORE_ID = "6761790801";
const ANDROID_PACKAGE = "app.garzoni.mobile";

/**
 * Lazily resolve expo-store-review. The native module ("ExpoStoreReview") is
 * only present in dev/release builds that were compiled after the package was
 * added — it's missing in Expo Go and stale dev clients. Importing it eagerly
 * at module scope throws there ("Cannot find native module"), which would take
 * down anything importing this file. Requiring it inside a guard lets the
 * review prompt simply no-op when the module isn't available.
 */
function getStoreReview(): typeof import("expo-store-review") | null {
  try {
    return require("expo-store-review") as typeof import("expo-store-review");
  } catch {
    return null;
  }
}

const LAST_PROMPT_KEY = "garzoni:review_prompt_last_ts";
const POSITIVE_EVENT_COUNT_KEY = "garzoni:review_prompt_positive_events";
// Set once the user has been routed to the store (tapped the positive option);
// our best available proxy for "left a review" since the OS never tells us.
const REVIEWED_KEY = "garzoni:review_prompt_reviewed";
const MIN_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
// Prompt after the user's first positive event (e.g. first lesson completed).
const MIN_POSITIVE_EVENTS = 1;
// Hard ceiling of 3 prompts per rolling 365 days — mirrors Apple's native
// SKStoreReviewController limit so our sentiment modal never over-asks a user
// who keeps dismissing it (the 30-day cooldown alone would allow ~12/year).
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_PROMPTS_PER_YEAR = 3;
const PROMPT_TIMESTAMPS_KEY = "garzoni:review_prompt_timestamps";

export type ReviewReason = "lesson_complete" | "quiz_pass" | "streak_milestone";

async function readNumber(key: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Decide whether to show the in-app sentiment prompt for a delight event.
 *
 * Gates on engagement only: the user needs a couple of positive events first,
 * and we self-gate to once per 30 days. Once the user has left a review (tapped
 * the positive option and been routed to the store, see {@link markReviewed}),
 * we never prompt again. Crucially this does NOT depend on the native review
 * module being available — the modal's unhappy path collects feedback with no
 * native dependency, and the happy path falls back to a store link when the
 * native sheet is unavailable. Returns true when the caller should open the
 * sentiment modal; stamps the "last prompt" timestamp so the cooldown starts now.
 */
export async function shouldPromptReview(
  reason: ReviewReason,
): Promise<boolean> {
  try {
    const reviewed = await AsyncStorage.getItem(REVIEWED_KEY);
    if (reviewed) return false;

    const positiveEvents = await readNumber(POSITIVE_EVENT_COUNT_KEY);
    const nextCount = positiveEvents + 1;
    await AsyncStorage.setItem(POSITIVE_EVENT_COUNT_KEY, String(nextCount));
    if (nextCount < MIN_POSITIVE_EVENTS) return false;

    const lastTs = await readNumber(LAST_PROMPT_KEY);
    const now = Date.now();
    if (lastTs && now - lastTs < MIN_INTERVAL_MS) return false;

    // Enforce the rolling 365-day ceiling on how many times we prompt.
    let timestamps: number[] = [];
    try {
      const raw = await AsyncStorage.getItem(PROMPT_TIMESTAMPS_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        timestamps = parsed.filter((t): t is number => typeof t === "number");
      }
    } catch {
      timestamps = [];
    }
    const recent = timestamps.filter((t) => now - t < YEAR_MS);
    if (recent.length >= MAX_PROMPTS_PER_YEAR) return false;

    recent.push(now);
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(now));
    await AsyncStorage.setItem(PROMPT_TIMESTAMPS_KEY, JSON.stringify(recent));
    return true;
  } catch {
    // Best-effort: never throw from a review prompt path.
    void reason;
    return false;
  }
}

/**
 * Mark the user as having left a review so the prompt never shows again.
 * Called from the positive-sentiment branch, which routes them to the store.
 */
export async function markReviewed(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEWED_KEY, "1");
  } catch {
    // Best-effort: never throw from a review prompt path.
  }
}

/**
 * Happy-path store action, called only after a user picked the positive
 * sentiment in our prompt. iOS shows the native in-app review sheet. Android's
 * In-App Review API policy forbids gating its native card behind a sentiment
 * question, so we send happy Android users to the Play Store listing instead
 * (linking to the listing is allowed).
 */
export async function triggerHappyPathStoreReview(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Linking.openURL(
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
      );
    } catch {
      // nothing more we can do
    }
    return;
  }

  try {
    const StoreReview = getStoreReview();
    if (
      StoreReview &&
      (await StoreReview.isAvailableAsync()) &&
      (await StoreReview.hasAction())
    ) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // fall through to the listing
  }

  try {
    await Linking.openURL(
      `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
    );
  } catch {
    // nothing more we can do
  }
}

/**
 * Triggered at moments of user delight. If gating passes, opens our in-app
 * sentiment prompt (instead of going straight to the store sheet), so happy
 * users get routed to the store and unhappy users tell us why first.
 */
export async function maybeRequestReview(reason: ReviewReason): Promise<void> {
  try {
    if (!(await shouldPromptReview(reason))) return;
    // Lazy require so the bootstrap module stays free of UI/store deps until used.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod =
      require("../components/review/reviewPromptStore") as typeof import("../components/review/reviewPromptStore");
    mod.useReviewPromptStore.getState().open(reason);
  } catch {
    // Best-effort: never throw from a review prompt path.
  }
}

/**
 * Manual "Rate app" action from Settings. The user explicitly asked, so skip the
 * delight-event gating used by maybeRequestReview: try the native in-app review
 * sheet first, then fall back to opening the store listing's review page.
 */
export async function openStoreReview(): Promise<void> {
  try {
    const StoreReview = getStoreReview();
    if (
      StoreReview &&
      (await StoreReview.isAvailableAsync()) &&
      (await StoreReview.hasAction())
    ) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // fall through to the store listing
  }

  const url =
    Platform.OS === "ios"
      ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  try {
    await Linking.openURL(url);
  } catch {
    // nothing more we can do
  }
}
