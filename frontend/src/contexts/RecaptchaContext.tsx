/**
 * reCAPTCHA Enterprise: lazy-load enterprise.js on auth routes only and expose
 * executeRecaptcha for Login/Register. Uses the single site key from the
 * hello@garzoni.app console.
 *
 * The script is NOT injected on non-auth pages (dashboard, subscriptions, etc.)
 * to avoid console noise from Google's reCAPTCHA client (e.g. the
 * "Unrecognized feature: 'private-token'" warning and the `/pat` probe) on
 * pages that never call executeRecaptcha.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

const SCRIPT_URL = "https://www.google.com/recaptcha/enterprise.js";

// Paths (prefix match) that are allowed to trigger script injection. Keep in
// sync with the routes in AppRoutes.tsx that call executeRecaptcha.
const AUTH_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/password-reset",
];

type RecaptchaContextValue = {
  executeRecaptcha: ((action: string) => Promise<string>) | null;
};

const RecaptchaContext = createContext<RecaptchaContextValue>({
  executeRecaptcha: null,
});

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (cb: () => void) => void;
        execute: (
          siteKey: string,
          options: { action: string }
        ) => Promise<string>;
      };
    };
  }
}

function pathNeedsRecaptcha(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function RecaptchaEnterpriseProvider({
  siteKey,
  children,
}: {
  siteKey: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [loadRequested, setLoadRequested] = useState(false);

  // Once we've entered an auth route we keep the flag sticky so navigating back
  // to it doesn't re-inject the script, and so leaving doesn't tear it down.
  useEffect(() => {
    if (!loadRequested && pathNeedsRecaptcha(location.pathname)) {
      setLoadRequested(true);
    }
  }, [location.pathname, loadRequested]);

  useEffect(() => {
    if (!loadRequested) return;
    if (!siteKey || typeof document === "undefined") return;
    const existing = document.querySelector(
      `script[src^="${SCRIPT_URL}"], script[src*="recaptcha/enterprise"]`
    );
    if (existing) {
      if (window.grecaptcha?.enterprise) {
        window.grecaptcha.enterprise.ready(() => setReady(true));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = `${SCRIPT_URL}?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => {
      window.grecaptcha?.enterprise?.ready(() => setReady(true));
    };
    document.head.appendChild(script);
  }, [loadRequested, siteKey]);

  const executeRecaptcha = useCallback(
    (action: string): Promise<string> => {
      if (!ready || !siteKey || !window.grecaptcha?.enterprise) {
        return Promise.reject(new Error("reCAPTCHA Enterprise not ready"));
      }
      return window.grecaptcha.enterprise.execute(siteKey, { action });
    },
    [ready, siteKey]
  );

  const value = useMemo<RecaptchaContextValue>(
    () => ({ executeRecaptcha: ready ? executeRecaptcha : null }),
    [ready, executeRecaptcha]
  );

  return (
    <RecaptchaContext.Provider value={value}>
      {children}
    </RecaptchaContext.Provider>
  );
}

export function useRecaptcha(): RecaptchaContextValue {
  return useContext(RecaptchaContext);
}
