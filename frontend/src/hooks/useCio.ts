import { useEffect, useRef } from "react";
import { APP_OPENED_LAST_YMD_KEY, runAppOpenedDailyGate } from "@garzoni/core";
import type { UserProfile } from "types/api";

declare global {
  interface Window {
    /** Customer.io legacy in-browser queue (populated before track.js loads). */
    _cio?: unknown[];
    cioanalytics?: { reset?: () => void };
  }
}

const SITE_ID = (import.meta.env.VITE_CIO_SITE_ID || "").trim();
const REGION = (import.meta.env.VITE_CIO_REGION || "us").toLowerCase();

let loadPromise: Promise<void> | null = null;

function cioQueue(): unknown[] {
  if (!window._cio) window._cio = [];
  return window._cio;
}

/**
 * Loads Customer.io track.js and configures account/region. Safe to call multiple times.
 */
export function initCustomerIoWeb(): Promise<void> {
  if (!SITE_ID) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (document.getElementById("cio-track-script")) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = "cio-track-script";
    s.async = true;
    s.src = "https://assets.customer.io/assets/track.js";
    s.onload = () => {
      try {
        const q = cioQueue();
        q.push(["_setAccount", SITE_ID]);
        if (REGION === "eu") {
          q.push(["_setDomain", "https://track-eu.customer.io"]);
        }
      } catch {
        /* noop */
      }
      resolve();
    };
    s.onerror = () => reject(new Error("Customer.io track.js failed to load"));
    document.head.appendChild(s);
  });

  return loadPromise.catch(() => {
    loadPromise = null;
  }) as Promise<void>;
}

function unixTs(d?: string | Date | null): number | undefined {
  if (!d) return undefined;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}

/**
 * Identify the logged-in person (same `id` as Django / mobile: user pk).
 */
export async function identifyCustomerIoUser(
  user: UserProfile | null
): Promise<void> {
  if (!SITE_ID || !user?.id) return;
  await initCustomerIoWeb();
  const id = String(user.id);
  const email = (user.email || user.user?.email || "").trim() || undefined;
  const traits: Record<string, unknown> = {
    id,
    ...(email ? { email } : {}),
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    workspace: "garzoni",
  };
  const created = unixTs(
    typeof user.user_data?.date_joined === "string"
      ? (user.user_data.date_joined as string)
      : undefined
  );
  if (created) traits.created_at = created;

  cioQueue().push(["identify", traits]);
}

/**
 * Emit `app_opened` at most once per browser-local day.
 *
 * Every Customer.io inactivity segment is "has NOT performed `app_opened`
 * within N days", and until now only the React Native SDK emitted it — so a
 * web-only user who logged in daily still sat in "Inactive 3+ days" forever and
 * collected the day-3 comeback mail. Same event name, same once-a-day gate as
 * mobile (the gate is shared in @garzoni/core) so the segments mean the same
 * thing on both platforms.
 */
export async function fireAppOpenedDailyWeb(): Promise<void> {
  if (!SITE_ID) return;
  await runAppOpenedDailyGate({
    readLastFired: () => {
      try {
        return window.localStorage.getItem(APP_OPENED_LAST_YMD_KEY);
      } catch {
        return null;
      }
    },
    writeLastFired: (ymd) => {
      try {
        window.localStorage.setItem(APP_OPENED_LAST_YMD_KEY, ymd);
      } catch {
        /* private mode / storage full — the event still fired */
      }
    },
    track: () => trackCustomerIoEvent("app_opened", { platform: "web" }),
  });
}

export async function resetCustomerIoWeb(): Promise<void> {
  if (!SITE_ID) return;
  await initCustomerIoWeb().catch(() => {});
  window.cioanalytics?.reset?.();
  const q = window._cio;
  if (Array.isArray(q)) q.push(["reset"]);
}

export async function trackCustomerIoPage(pathname: string): Promise<void> {
  if (!SITE_ID) return;
  await initCustomerIoWeb();
  cioQueue().push(["trackPageView", { url: pathname }]);
}

export async function trackCustomerIoEvent(
  name: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!SITE_ID) return;
  await initCustomerIoWeb();
  cioQueue().push(["track", name, properties ?? {}]);
}

/**
 * Fires `_cio` page views when React Router location changes.
 */
export function useCioPageTrack(pathname: string): void {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!SITE_ID) return;
    if (prev.current === pathname) return;
    prev.current = pathname;
    void trackCustomerIoPage(pathname);
  }, [pathname]);
}
