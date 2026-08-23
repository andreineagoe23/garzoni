import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Remembers that the priming screen (PushPromptScreen) has been shown, so the
 * one-shot OS dialog is never spent twice and users are not re-nagged on every
 * cold start.
 *
 * Kept separate from the OS permission status on purpose: "asked" and "granted"
 * are different states, and a user who declined must not be re-prompted just
 * because the OS still reports `undetermined` on Android.
 */
const ASKED_KEY = "garzoni:push_prompt_asked";
/**
 * Set once the user has completed a lesson, which is what earns the ask.
 *
 * iOS grants exactly one permission dialog per install. Onboarding used to spend
 * it on someone who had learned nothing yet, so most people declined and the
 * device never reached Customer.io — the reason only a sixth of accounts had a
 * push token. The prompt now waits until there is something to be notified about.
 */
const DUE_KEY = "garzoni:push_prompt_due";

export async function hasAskedForPush(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1";
  } catch {
    // Storage unavailable → assume asked, so a failure can never turn into a
    // prompt loop on every launch.
    return true;
  }
}

/** Called on every lesson completion; cheap and idempotent. */
export async function markPushPromptDue(): Promise<void> {
  try {
    await AsyncStorage.setItem(DUE_KEY, "1");
  } catch {
    /* best effort */
  }
}

export async function isPushPromptDue(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DUE_KEY)) === "1";
  } catch {
    // Storage unavailable → treat as not due. Failing closed here costs one
    // deferred prompt; failing open spends the one-shot dialog on a stranger.
    return false;
  }
}

export async function markAskedForPush(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* best effort */
  }
}
