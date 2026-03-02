/**
 * reCAPTCHA Enterprise: load enterprise.js and expose executeRecaptcha for Login/Register.
 * Uses the single site key from the monevo.educational@gmail.com console.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const SCRIPT_URL = "https://www.google.com/recaptcha/enterprise.js";

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

export function RecaptchaEnterpriseProvider({
  siteKey,
  children,
}: {
  siteKey: string;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, [siteKey]);

  const executeRecaptcha = useCallback(
    (action: string): Promise<string> => {
      if (!ready || !siteKey || !window.grecaptcha?.enterprise) {
        return Promise.reject(new Error("reCAPTCHA Enterprise not ready"));
      }
      return window.grecaptcha.enterprise.execute(siteKey, { action });
    },
    [ready, siteKey]
  );

  const value: RecaptchaContextValue = {
    executeRecaptcha: ready ? executeRecaptcha : null,
  };

  return (
    <RecaptchaContext.Provider value={value}>
      {children}
    </RecaptchaContext.Provider>
  );
}

export function useRecaptcha(): RecaptchaContextValue {
  return useContext(RecaptchaContext);
}
