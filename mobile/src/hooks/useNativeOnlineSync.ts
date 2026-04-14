import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { invalidateOnlineDependentQueries } from "@garzoni/core";

/**
 * Mirrors web `useOnlineSync`: when connectivity returns, refresh review queue + missions.
 */
export function useNativeOnlineSync() {
  const queryClient = useQueryClient();
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false;
      if (wasOfflineRef.current && !offline) {
        invalidateOnlineDependentQueries(queryClient);
      }
      wasOfflineRef.current = offline;
    });
    void NetInfo.fetch().then((s) => {
      wasOfflineRef.current = s.isConnected === false;
    });
    return () => sub();
  }, [queryClient]);
}
