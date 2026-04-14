import type { WebViewProps } from "react-native-webview";
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from "react-native-webview/lib/WebViewTypes";

/**
 * Forward WebView load / HTTP issues to Metro in development.
 * For JS inside the page, use Safari → Develop → Simulator → [WebView].
 */
export function webViewDevLoggingProps(): Pick<
  WebViewProps,
  "onError" | "onHttpError"
> {
  if (!__DEV__) return {};
  return {
    onError: (e: WebViewErrorEvent) => {
      console.error("[WebView]", e.nativeEvent.description, e.nativeEvent);
    },
    onHttpError: (e: WebViewHttpErrorEvent) => {
      console.error(
        "[WebView HTTP]",
        e.nativeEvent.statusCode,
        e.nativeEvent.url,
      );
    },
  };
}
