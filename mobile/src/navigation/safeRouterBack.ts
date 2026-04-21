import { router } from "expo-router";
import { href } from "./href";

/** Pops when possible; avoids unhandled GO_BACK when there is no parent route. */
export function safeRouterBack(fallbackPath: string) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(href(fallbackPath));
  }
}
