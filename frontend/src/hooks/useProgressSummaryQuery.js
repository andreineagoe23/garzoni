import { useQuery } from "@tanstack/react-query";
import { fetchProgressSummary } from "services/userService";
import { queryKeys, staleTimes } from "lib/reactQuery";

export function useProgressSummaryQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: fetchProgressSummary,
    staleTime: staleTimes.progressSummary,
    ...options,
  });
}


