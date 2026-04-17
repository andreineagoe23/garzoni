import { QueryClient } from "@tanstack/react-query";

/** React Query client tuned for unit tests (no retries, isolated per test file usage). */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
