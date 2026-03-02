/**
 * Optional: Google One Tap and Sign-in button (Google Identity Services).
 * Login/Register currently use the redirect flow only. Use this component when
 * Authorized JavaScript origins are configured and you want in-page sign-in.
 * POSTs credential to /api/auth/google/verify-credential/, then onSuccess(access, next).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import apiClient from "services/httpClient";
import { GOOGLE_OAUTH_CLIENT_ID } from "services/backendUrl";
import { useTheme } from "contexts/ThemeContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (
            momentListener?: (moment: {
              getDismissedReason: () => string;
            }) => void
          ) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              type?: string;
              text?: string;
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export type GoogleSignInProps = {
  /** e.g. "all-topics" for login, "onboarding" for register */
  state?: string;
  /** Called with our access token and next path after backend verification */
  onSuccess: (accessToken: string, nextPath: string) => void;
  /** Called on credential or network error */
  onError: (message: string) => void;
  /** Show One Tap prompt (floating UI). Default true. */
  showOneTap?: boolean;
  /** Set true while handling credential to disable button / avoid double submit */
  disabled?: boolean;
  /** Render only the inline button (no One Tap). Use when clientId not set to show fallback link */
  buttonOnly?: boolean;
  /** Button container class name */
  className?: string;
  /** Button type: "standard" (default) or "icon" */
  buttonType?: "standard" | "icon";
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export default function GoogleSignIn({
  state = "all-topics",
  onSuccess,
  onError,
  showOneTap = true,
  disabled = false,
  buttonOnly = false,
  className = "",
  buttonType = "standard",
}: GoogleSignInProps) {
  const { darkMode } = useTheme();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const handlingRef = useRef(false);

  const handleCredential = useCallback(
    async (credential: string) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      try {
        const { data } = await apiClient.post<{
          access: string;
          user: unknown;
          next: string;
        }>("/auth/google/verify-credential/", { credential, state });
        if (data?.access && data?.next != null) {
          onSuccess(data.access, data.next);
        } else {
          onError("Invalid response from server.");
        }
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) &&
          typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : ((err as Error)?.message ?? "Google sign-in failed.");
        onError(msg);
      } finally {
        handlingRef.current = false;
      }
    },
    [state, onSuccess, onError]
  );

  useEffect(() => {
    if (!GOOGLE_OAUTH_CLIENT_ID) {
      return;
    }
    let cancelled = false;
    loadScript(GSI_SCRIPT_URL)
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        setScriptReady(true);
      })
      .catch(() => {
        if (!cancelled) onError("Could not load Google sign-in.");
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    if (!scriptReady || !GOOGLE_OAUTH_CLIENT_ID || initialized) return;
    const google = window.google?.accounts?.id;
    if (!google) return;

    google.initialize({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      callback: (response) => {
        if (response?.credential) handleCredential(response.credential);
      },
      cancel_on_tap_outside: true,
    });
    setInitialized(true);
  }, [scriptReady, initialized, handleCredential]);

  useEffect(() => {
    if (!showOneTap || !initialized || buttonOnly) return;
    const timer = setTimeout(() => {
      window.google?.accounts?.id?.prompt?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [showOneTap, initialized, buttonOnly]);

  useEffect(() => {
    if (
      !scriptReady ||
      !initialized ||
      !buttonRef.current ||
      !GOOGLE_OAUTH_CLIENT_ID
    )
      return;
    // Clear previous button content so renderButton doesn't duplicate; re-render when theme changes
    buttonRef.current.innerHTML = "";
    window.google?.accounts?.id?.renderButton(buttonRef.current, {
      theme: darkMode ? "filled_black" : "outline",
      size: "large",
      type: buttonType,
      text: "signin_with",
      width: buttonRef.current.offsetWidth || 320,
    });
  }, [scriptReady, initialized, buttonType, darkMode]);

  const hasGoogle = Boolean(GOOGLE_OAUTH_CLIENT_ID);

  if (!hasGoogle) {
    return null;
  }

  return (
    <div className={className}>
      {scriptReady && initialized ? (
        <div
          ref={buttonRef}
          className="flex justify-center [&>div]:!w-full [&>div]:!flex [&>div]:!justify-center"
          style={{
            minHeight: 44,
            opacity: disabled ? 0.6 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
          role="presentation"
        />
      ) : (
        <div
          className="flex h-11 w-full items-center justify-center rounded-lg border border-[color:var(--border-color)] bg-[color:var(--card-bg)] text-sm text-[color:var(--muted-text)]"
          aria-hidden="true"
        >
          …
        </div>
      )}
    </div>
  );
}
