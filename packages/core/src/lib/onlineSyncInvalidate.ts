import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./reactQuery";

/** Shared by web `useOnlineSync` and native reconnect handlers. */
export function invalidateOnlineDependentQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
}
