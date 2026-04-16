import { useEffect, useRef } from "react";
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
