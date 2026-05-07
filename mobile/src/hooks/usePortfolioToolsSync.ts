import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@garzoni/core";

/**
 * After virtual buys or portfolio changes from Market Explorer, keep Analyzer + shared savings queries fresh.
 */
export function useInvalidatePortfolioTools() {
  const qc = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.portfolioDashboard() }),
      qc.invalidateQueries({ queryKey: queryKeys.savingsBalance() }),
    ]);
  }, [qc]);
}
