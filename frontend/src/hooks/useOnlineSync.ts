import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "lib/reactQuery";

export const useOnlineSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [queryClient]);
};
