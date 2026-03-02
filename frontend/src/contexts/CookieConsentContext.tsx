/**
 * In-app cookie consent (GDPR-style). Replaces Usercentrics/Cookiebot.
 * - Reject as prominent as Accept (EDPB)
 * - No pre-ticked optional categories
 * - Withdraw via "Cookie settings" in footer
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "monevo_cookie_consent";
export const CONSENT_EVENT = "MonevoCookieConsent";
export const OPEN_SETTINGS_EVENT = "monevo-open-cookie-settings";

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp?: number;
};

const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
};

function loadConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.necessary !== "boolean" && parsed.necessary !== true)
      return null;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      timestamp:
        typeof parsed.timestamp === "number" ? parsed.timestamp : undefined,
    };
  } catch {
    return null;
  }
}

function saveConsent(state: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    const toSave = { ...state, timestamp: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    (
      window as Window & { __MONEVO_CONSENT__?: ConsentState }
    ).__MONEVO_CONSENT__ = toSave;
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: toSave }));
  } catch (_) {
    // ignore
  }
}

type CookieConsentContextValue = {
  /** User has made a choice (so we can hide the banner). */
  hasAnswered: boolean;
  /** Current consent (after answer; before answer, optional cookies are false). */
  consent: ConsentState;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  setPreferences: (prefs: { analytics: boolean; marketing: boolean }) => void;
  openSettings: () => void;
  /** Show the settings modal (used by footer "Cookie settings" link). */
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
};

const CookieConsentContext = createContext<
  CookieConsentContextValue | undefined
>(undefined);

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [consent, setConsentState] = useState<ConsentState | null>(() =>
    loadConsent()
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hasAnswered = consent !== null;

  useEffect(() => {
    if (consent) {
      (
        window as Window & { __MONEVO_CONSENT__?: ConsentState }
      ).__MONEVO_CONSENT__ = consent;
    }
  }, [consent]);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

  const acceptAll = useCallback(() => {
    const next: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    setConsentState(next);
    saveConsent(next);
  }, []);

  const rejectNonEssential = useCallback(() => {
    const next: ConsentState = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    setConsentState(next);
    saveConsent(next);
  }, []);

  const setPreferences = useCallback(
    (prefs: { analytics: boolean; marketing: boolean }) => {
      const next: ConsentState = {
        necessary: true,
        analytics: prefs.analytics,
        marketing: prefs.marketing,
      };
      setConsentState(next);
      saveConsent(next);
    },
    []
  );

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      hasAnswered,
      consent: consent ?? DEFAULT_CONSENT,
      acceptAll,
      rejectNonEssential,
      setPreferences,
      openSettings,
      settingsOpen,
      setSettingsOpen,
    }),
    [
      hasAnswered,
      consent,
      acceptAll,
      rejectNonEssential,
      setPreferences,
      openSettings,
      settingsOpen,
    ]
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (ctx === undefined) {
    throw new Error(
      "useCookieConsent must be used within CookieConsentProvider"
    );
  }
  return ctx;
}

/** Use outside React (e.g. in index.html GA loader): read from localStorage or window.__MONEVO_CONSENT__. */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { __MONEVO_CONSENT__?: ConsentState };
  if (w.__MONEVO_CONSENT__?.analytics) return true;
  const stored = loadConsent();
  return stored?.analytics ?? false;
}
