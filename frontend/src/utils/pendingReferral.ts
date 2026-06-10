const KEY = "garzoni:pending_referral_code";

function normalize(code: string | null | undefined): string {
  return (code ?? "").trim();
}

export function savePendingReferralCode(code: string | null | undefined): void {
  const normalized = normalize(code);
  if (!normalized) return;
  try {
    localStorage.setItem(KEY, normalized);
  } catch {
    // best-effort
  }
}

export function peekPendingReferralCode(): string {
  try {
    return normalize(localStorage.getItem(KEY));
  } catch {
    return "";
  }
}

/** Reads and clears the pending referral code in one shot. */
export function consumePendingReferralCode(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.removeItem(KEY);
    return normalize(raw);
  } catch {
    return "";
  }
}
