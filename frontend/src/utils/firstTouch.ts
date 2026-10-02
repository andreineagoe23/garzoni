/**
 * First-touch acquisition context: where a visitor came from on their first page
 * view. Captured once per browser, sent with the register request, and stored on
 * the profile (`signup_attribution`) so signups can be split by source.
 */
const KEY = "garzoni:first_touch";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type FirstTouch = Partial<
  Record<(typeof UTM_KEYS)[number] | "referrer" | "landing_path", string>
>;

/** Record the first page view's context. Later visits never overwrite it. */
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const touch: FirstTouch = { landing_path: window.location.pathname };
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) touch[key] = value;
    }
    const referrer = document.referrer;
    if (referrer && new URL(referrer).host !== window.location.host) {
      touch.referrer = referrer;
    }
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    // best-effort
  }
}

export function readFirstTouch(): FirstTouch | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : undefined;
  } catch {
    return undefined;
  }
}
