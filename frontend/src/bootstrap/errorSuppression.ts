type ReactErrorOverlayHook = {
  onError?: (error: unknown, info: unknown) => void;
  onUnhandledRejection?: (reason: unknown, promise: Promise<unknown>) => void;
  __garzoni_patched?: boolean;
};

declare global {
  interface Window {
    __REACT_ERROR_OVERLAY_GLOBAL_HOOK__?: ReactErrorOverlayHook;
  }
}

const isThirdPartyOrScriptError = (
  message: string,
  source?: string,
  stack?: string
) => {
  const msg = (message || "").toLowerCase();
  const src = (source || "").toLowerCase();
  const stk = (stack || "").toLowerCase();
  if (msg === "script error." || msg === "script error") return true;
  const thirdPartyMessage =
    msg.includes("invalid environment") ||
    msg.includes("couldn't load support") ||
    msg.includes("support portal") ||
    msg.includes("dataproblemmodel") ||
    msg.includes("queryselector") ||
    /script error|resizeobserver|loading chunk failed/i.test(message);
  const thirdPartySource =
    src.includes("tradingview") ||
    src.includes("s3.tradingview") ||
    src.includes("snowplow") ||
    src.includes("embed-widget") ||
    src.includes("embed_events") ||
    src.includes("embed_timeline");
  const thirdPartyStack =
    stk.includes("tradingview") ||
    stk.includes("embed-widget") ||
    stk.includes("embed_events") ||
    stk.includes("embed_timeline") ||
    stk.includes("snowplow") ||
    stk.includes("support-portal") ||
    stk.includes("19052.") ||
    stk.includes("66224.");
  return thirdPartyMessage || thirdPartySource || thirdPartyStack;
};

export const initErrorSuppression = () => {
  if (typeof window === "undefined") return;

  const suppressScriptError = (event: ErrorEvent) => {
    if (
      isThirdPartyOrScriptError(
        event.message,
        event.filename,
        event.error?.stack
      )
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
    return false;
  };

  window.addEventListener("error", suppressScriptError, true);
  window.onerror = (message, source, _lineno, _colno, error) => {
    if (isThirdPartyOrScriptError(String(message), source, error?.stack))
      return true;
    return false;
  };

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event?.reason;
      const msg = reason?.message != null ? String(reason.message) : "";
      const stack = reason?.stack != null ? String(reason.stack) : "";
      if (isThirdPartyOrScriptError(msg, undefined, stack)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  const patchOverlay = () => {
    const hook = window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__;
    if (!hook || hook.__garzoni_patched) return;
    const isSuppressible = (value: unknown) => {
      const valueObj = value as { message?: unknown; stack?: unknown } | null;
      const msg =
        typeof value === "string" ? value : String(valueObj?.message ?? "");
      const stack = String(valueObj?.stack ?? "");
      return isThirdPartyOrScriptError(msg, undefined, stack);
    };
    const originalOnError = hook.onError;
    const originalOnRejection = hook.onUnhandledRejection;
    hook.onError = (error: unknown, info: unknown) => {
      if (isSuppressible(error)) return;
      return originalOnError?.(error, info);
    };
    hook.onUnhandledRejection = (
      reason: unknown,
      promise: Promise<unknown>
    ) => {
      if (isSuppressible(reason)) return;
      return originalOnRejection?.(reason, promise);
    };
    hook.__garzoni_patched = true;
  };

  patchOverlay();
  const overlayInterval = window.setInterval(patchOverlay, 500);
  window.setTimeout(() => window.clearInterval(overlayInterval), 15000);
};
