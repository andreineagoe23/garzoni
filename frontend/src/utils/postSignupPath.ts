/**
 * Where to send a new user once onboarding is done — e.g. back into the course
 * of the public lesson they were reading when they hit "Create a free account".
 * Set from `/register?next=…`, consumed once by the end of onboarding.
 */
const KEY = "garzoni:post_signup_path";

/** Same-origin app paths only: never "//host" or a full URL (open redirect). */
function isAppPath(path: string): boolean {
  return /^\/(?![/\\])/.test(path);
}

export function savePostSignupPath(path: string | null | undefined): void {
  const trimmed = (path ?? "").trim();
  if (!trimmed || !isAppPath(trimmed)) return;
  try {
    localStorage.setItem(KEY, trimmed);
  } catch {
    // best-effort
  }
}

/** Reads and clears the saved path in one shot; "" when there is none. */
export function consumePostSignupPath(): string {
  try {
    const raw = localStorage.getItem(KEY) ?? "";
    if (raw) localStorage.removeItem(KEY);
    return isAppPath(raw) ? raw : "";
  } catch {
    return "";
  }
}
