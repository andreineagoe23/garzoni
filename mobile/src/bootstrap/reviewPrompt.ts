import AsyncStorage from "@react-native-async-storage/async-storage";

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
const MIN_INTERVAL_MS = 120 * 24 * 60 * 60 * 1000;
const MIN_POSITIVE_EVENTS = 3;

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
 * Triggered at moments of user delight. Apple shows the system review dialog at most
 * 3 times per 365 days regardless of how often this is called, but we self-gate to
 * once per 120 days and require at least a couple of positive events first.
 */
export async function maybeRequestReview(reason: ReviewReason): Promise<void> {
  try {
    const StoreReview = getStoreReview();
    if (!StoreReview) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    const positiveEvents = await readNumber(POSITIVE_EVENT_COUNT_KEY);
    const nextCount = positiveEvents + 1;
    await AsyncStorage.setItem(POSITIVE_EVENT_COUNT_KEY, String(nextCount));
    if (nextCount < MIN_POSITIVE_EVENTS) return;

    const lastTs = await readNumber(LAST_PROMPT_KEY);
    const now = Date.now();
    if (lastTs && now - lastTs < MIN_INTERVAL_MS) return;

    await StoreReview.requestReview();
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(now));
  } catch {
    // Best-effort: never throw from a review prompt path.
    void reason;
  }
}
