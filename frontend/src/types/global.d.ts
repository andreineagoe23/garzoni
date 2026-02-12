import type * as React from "react";

export {};

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }

  interface NetworkInformation {
    saveData?: boolean;
    effectiveType?: string;
  }

  interface SpeechRecognition {
    lang: string;
    interimResults: boolean;
    maxAlternatives?: number;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    start: () => void;
    stop: () => void;
  }

  interface Window {
    gtag?: (...args: any[]) => void;
    /** Set by our cookie consent (CookieConsentContext). Use for analytics gating. */
    __MONEVO_CONSENT__?: {
      necessary: true;
      analytics: boolean;
      marketing: boolean;
      timestamp?: number;
    };
    RemoteCalc?: (...args: any[]) => void;
    UC_UI?: {
      showSecondLayer?: () => void;
    };
    requestIdleCallback?: (
      callback: (deadline: { timeRemaining: () => number }) => void,
      options?: { timeout?: number }
    ) => number;
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  namespace JSX {
    interface IntrinsicElements {
      "tv-economic-map": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { theme?: "dark" | "light" },
        HTMLElement
      >;
    }
  }
}
