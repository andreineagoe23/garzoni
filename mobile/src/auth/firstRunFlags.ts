import AsyncStorage from "@react-native-async-storage/async-storage";

const WELCOME_SEEN_KEY = "garzoni:welcome_seen_v1";
const PLAN_CHOSEN_KEY = "garzoni:plan_chosen_v1";
const WELCOME_HEADER_PENDING_KEY = "garzoni:dashboard_welcome_header_pending_v1";

export async function getWelcomeSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WELCOME_SEEN_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function getPlanChosenCache(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PLAN_CHOSEN_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setPlanChosenCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAN_CHOSEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function clearPlanChosenCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PLAN_CHOSEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function clearWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WELCOME_SEEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function markWelcomeHeaderPending(): Promise<void> {
  try {
    await AsyncStorage.setItem(WELCOME_HEADER_PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function consumeWelcomeHeaderPending(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(WELCOME_HEADER_PENDING_KEY);
    if (v === "1") {
      await AsyncStorage.removeItem(WELCOME_HEADER_PENDING_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function clearWelcomeHeaderPending(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WELCOME_HEADER_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
