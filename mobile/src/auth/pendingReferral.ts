import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "garzoni:pending_referral_code";

function normalize(code: string | null | undefined): string {
  return (code ?? "").trim();
}

export async function savePendingReferralCode(
  code: string | null | undefined,
): Promise<void> {
  const normalized = normalize(code);
  if (!normalized) return;
  try {
    await AsyncStorage.setItem(KEY, normalized);
  } catch {
    // best-effort
  }
}

/** Reads and clears the pending referral code in one shot. */
export async function consumePendingReferralCode(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) await AsyncStorage.removeItem(KEY);
    return normalize(raw);
  } catch {
    return "";
  }
}
