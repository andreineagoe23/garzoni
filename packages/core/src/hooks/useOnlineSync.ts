import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateOnlineDependentQueries } from "../lib/onlineSyncInvalidate";

export const useOnlineSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }

    const handleOnline = () => {
      invalidateOnlineDependentQueries(queryClient);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [queryClient]);
};
