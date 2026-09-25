import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import { trackGarzoniEvent } from "./customerIoMobile";

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-store-review") as typeof import("expo-store-review");
  } catch {
    return null;
  }
}

/** The native review module, or null when it can't show a review sheet. */
async function getAvailableStoreReview(): Promise<
  typeof import("expo-store-review") | null
> {
  try {
    const StoreReview = getStoreReview();
    if (
      StoreReview &&
      (await StoreReview.isAvailableAsync()) &&
      (await StoreReview.hasAction())
    ) {
      return StoreReview;
    }
  } catch {
    // treat as unavailable
  }
  return null;
}

const LAST_PROMPT_KEY = "garzoni:review_prompt_last_ts";
const POSITIVE_EVENT_COUNT_KEY = "garzoni:review_prompt_positive_events";
// Set once the user has been routed to the store (older builds' "Love it" path,
// or the manual Settings "Rate app" action); our best available proxy for
// "left a review" since the OS never tells us.
const REVIEWED_KEY = "garzoni:review_prompt_reviewed";
const MIN_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
// Prompt after the user's first positive event (e.g. first lesson completed).
const MIN_POSITIVE_EVENTS = 1;
// Hard ceiling of 3 prompts per rolling 365 days — mirrors Apple's native
// SKStoreReviewController limit (the 30-day cooldown alone would allow ~12/year).
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
 * Frequency gate for the automatic review request at a delight event.
 *
 * Gates on engagement only: the user needs a positive event first, and we
 * self-gate to once per 30 days and at most 3 times per rolling year. Once the
 * user has been routed to the store (see {@link markReviewed}) we never ask
 * again. Returns true when the caller should request the native review sheet;
 * stamps the "last prompt" timestamp so the cooldown starts now.
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

/** Mark the user as having been routed to the store so we never auto-ask again. */
export async function markReviewed(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEWED_KEY, "1");
  } catch {
    // Best-effort: never throw from a review prompt path.
  }
}

/**
 * Triggered at moments of user delight. If the frequency gate passes, show the
 * native review sheet (Play In-App Review / SKStoreReviewController) directly.
 *
 * No question of any kind precedes it: Play's in-app review policy forbids
 * asking "do you like the app?" before or while showing the card, and forbids
 * steering only happy users to it. When the native sheet is unavailable (Expo
 * Go, stale dev client, no Play Store) we do nothing — never open a store link
 * unprompted — and the gate isn't consumed. The OS self-quotas and may show
 * nothing; our own gate still applies.
 */
export async function maybeRequestReview(reason: ReviewReason): Promise<void> {
  try {
    const StoreReview = await getAvailableStoreReview();
    if (!StoreReview) return;
    if (!(await shouldPromptReview(reason))) return;

    void trackGarzoniEvent("app_review_requested", { reason });
    await StoreReview.requestReview();
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
  void markReviewed();

  const StoreReview = await getAvailableStoreReview();
  if (StoreReview) {
    try {
      await StoreReview.requestReview();
      return;
    } catch {
      // fall through to the store listing
    }
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
