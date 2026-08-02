import { useEffect, useMemo } from "react";
import { usePathname } from "expo-router";
import { apiClient } from "@garzoni/core";

/**
 * Reports `tool_open` for whichever tool screen is showing.
 *
 * This is not just analytics: the backend advances multi-step quest "tool"
 * steps off this event (gamification/signals.py advance_multistep_tool), so a
 * tool stack that doesn't fire it leaves those steps permanently incomplete.
 * Both tool stacks call it — `usePathname()` drops group segments, so
 * `(tabs)/tools/portfolio` and `tools/portfolio` both read as
 * `/tools/portfolio`.
 */
export function useToolOpenEvent() {
  const pathname = usePathname();
  const activeToolSlug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "tools") return null;
    return parts[1] || null;
  }, [pathname]);

  useEffect(() => {
    if (!activeToolSlug) return;
    void (
      apiClient as unknown as {
        post: (url: string, body: unknown) => Promise<unknown>;
      }
    )
      .post("/funnel/events/", {
        event_type: "tool_open",
        metadata: {
          tool_slug: activeToolSlug,
          tool_name: activeToolSlug,
          source: "mobile_route",
          surface: "mobile",
        },
      })
      .catch(() => undefined);
  }, [activeToolSlug]);
}
