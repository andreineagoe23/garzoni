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

export async function hasAskedForPush(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1";
  } catch {
    // Storage unavailable → assume asked, so a failure can never turn into a
    // prompt loop on every launch.
    return true;
  }
}

export async function markAskedForPush(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* best effort */
  }
}
