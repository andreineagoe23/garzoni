import { useQuery } from "@tanstack/react-query";
import { fetchWhatsNext } from "services/userService";
import { queryKeys, staleTimes } from "../lib/reactQuery";

export function useWhatsNext(options = {}) {
  return useQuery({
    queryKey: queryKeys.whatsNext(),
    queryFn: fetchWhatsNext,
    staleTime: staleTimes.progressSummary,
    ...options,
  });
}
