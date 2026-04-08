import { useState, useCallback } from "react";

/**
 * Hook for retry logic with exponential backoff
 */
export const useRetry = (maxRetries = 3, initialDelay = 1000) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(
    async <T>(fn: () => Promise<T>) => {
      if (retryCount >= maxRetries) {
        setRetryCount(0);
        return {
          success: false as const,
          error: "Max retries exceeded" as const,
        };
      }

      setIsRetrying(true);
      const delay = initialDelay * Math.pow(2, retryCount);

      try {
        await new Promise((resolve) => setTimeout(resolve, delay));
        const result = await fn();
        setRetryCount(0);
        setIsRetrying(false);
        return { success: true, data: result };
      } catch (error) {
        setRetryCount((prev) => prev + 1);
        setIsRetrying(false);
        return { success: false as const, error };
      }
    },
    [retryCount, maxRetries, initialDelay],
  );

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return { retry, isRetrying, retryCount, reset };
};
