import { useCallback, useEffect, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import {
  decrementHearts,
  fetchHearts,
  grantHearts,
  refillHearts,
} from "services/userService";
import { queryKeys, staleTimes } from "../lib/reactQuery";
import { createMutationOptions } from "../lib/createMutation";
import { initHeartsTabSync, useHeartsStore } from "../stores/heartsStore";

const DEFAULT_MAX_HEARTS = 5;

type UseHeartsOptions = {
  enabled?: boolean;
  refetchIntervalMs?: number;
};

export function useHearts({
  enabled = true,
  refetchIntervalMs = 30_000,
}: UseHeartsOptions = {}) {
  const queryClient = useQueryClient();

  // One-time: keep cross-tab timestamps in sync.
  useEffect(() => {
    initHeartsTabSync();
  }, []);

  const isOutOfHeartsModalOpen = useHeartsStore(
    (s) => s.isOutOfHeartsModalOpen,
  );
  const setOutOfHeartsModalOpen = useHeartsStore(
    (s) => s.setOutOfHeartsModalOpen,
  );
  const outOfHeartsUntilTs = useHeartsStore((s) => s.outOfHeartsUntilTs);
  const setOutOfHeartsUntilTs = useHeartsStore((s) => s.setOutOfHeartsUntilTs);
  const lastSeenServerHeartsTs = useHeartsStore(
    (s) => s.lastSeenServerHeartsTs,
  );
  const setLastSeenServerHeartsTs = useHeartsStore(
    (s) => s.setLastSeenServerHeartsTs,
  );

  const heartsQuery = useQuery({
    queryKey: queryKeys.hearts(),
    queryFn: () => fetchHearts().then((response) => response.data),
    enabled: Boolean(enabled),
    staleTime: staleTimes.hearts,
    // Hearts are high-signal / time-sensitive. When the user returns to the tab, refresh.
    refetchOnWindowFocus: Boolean(enabled),
    refetchInterval: enabled ? refetchIntervalMs : false,
  });

  useEffect(() => {
    if (heartsQuery.data) {
      const now = Date.now();
      setLastSeenServerHeartsTs(now);

      const serverHearts = heartsQuery.data?.hearts;
      const nextHeartInSeconds = heartsQuery.data?.next_heart_in_seconds;

      // If out of hearts, publish a cross-tab timestamp for when a heart should regenerate.
      if (
        enabled &&
        typeof serverHearts === "number" &&
        serverHearts <= 0 &&
        Number.isFinite(nextHeartInSeconds)
      ) {
        setOutOfHeartsUntilTs(now + Math.ceil(nextHeartInSeconds * 1000));
      } else if (
        enabled &&
        typeof serverHearts === "number" &&
        serverHearts <= 0 &&
        !Number.isFinite(nextHeartInSeconds)
      ) {
        // Avoid stale cross-tab timestamps if the backend doesn't provide a countdown.
        setOutOfHeartsUntilTs(null);
      } else if (
        !enabled ||
        (typeof serverHearts === "number" && serverHearts > 0)
      ) {
        // Clear the "blocked until" timestamp once the user has hearts again.
        setOutOfHeartsUntilTs(null);
        setOutOfHeartsModalOpen(false);
      }
    }
  }, [
    enabled,
    heartsQuery.data,
    setLastSeenServerHeartsTs,
    setOutOfHeartsUntilTs,
    setOutOfHeartsModalOpen,
  ]);

  // Keep the out-of-hearts modal UX in sync with server truth (query data).
  useEffect(() => {
    if (!enabled) {
      setOutOfHeartsModalOpen(false);
      return;
    }
    if (
      typeof heartsQuery.data?.hearts === "number" &&
      heartsQuery.data.hearts <= 0
    ) {
      setOutOfHeartsModalOpen(true);
      return;
    }
    if (
      typeof heartsQuery.data?.hearts === "number" &&
      heartsQuery.data.hearts > 0
    ) {
      setOutOfHeartsModalOpen(false);
    }
  }, [enabled, heartsQuery.data?.hearts, setOutOfHeartsModalOpen]);

  const decrementMutation = useMutation(
    createMutationOptions({
      queryClient,
      mutationFn: () => decrementHearts(1).then((r) => r.data),
      invalidate: [queryKeys.hearts()],
      updateQueryData: (qc, data) => {
        qc.setQueryData(queryKeys.hearts(), data);
      },
    }),
  );

  const grantMutation = useMutation<unknown, Error, unknown>(
    createMutationOptions({
      queryClient,
      mutationFn: (amount: unknown) =>
        grantHearts(Number(amount)).then((r) => r.data),
      invalidate: [queryKeys.hearts()],
      updateQueryData: (qc, data) => {
        qc.setQueryData(queryKeys.hearts(), data);
      },
    }) as UseMutationOptions<unknown, Error, unknown>,
  );

  const refillMutation = useMutation(
    createMutationOptions({
      queryClient,
      mutationFn: () => refillHearts().then((r) => r.data),
      invalidate: [queryKeys.hearts()],
      updateQueryData: (qc, data) => {
        qc.setQueryData(queryKeys.hearts(), data);
      },
    }),
  );

  // Concurrency guardrails: prevent rapid double-spends (double taps, retries, etc.).
  const decrementLockRef = useRef(false);
  const grantLockRef = useRef(false);
  const refillLockRef = useRef(false);

  const decrementHeart = useCallback(() => {
    if (decrementMutation.isPending || decrementLockRef.current) return;
    decrementLockRef.current = true;
    decrementMutation.mutate(undefined, {
      onSettled: () => {
        decrementLockRef.current = false;
      },
    });
  }, [decrementMutation]);

  const grantHeartsSafe = useCallback(
    async (amount: unknown) => {
      if (grantMutation.isPending || grantLockRef.current) return null;
      grantLockRef.current = true;
      try {
        return await grantMutation.mutateAsync(amount);
      } finally {
        grantLockRef.current = false;
      }
    },
    [grantMutation],
  );

  const refillHeartsSafe = useCallback(async () => {
    if (refillMutation.isPending || refillLockRef.current) return null;
    refillLockRef.current = true;
    try {
      return await refillMutation.mutateAsync(undefined);
    } finally {
      refillLockRef.current = false;
    }
  }, [refillMutation]);

  const maxHearts = enabled
    ? (heartsQuery.data?.max_hearts ?? DEFAULT_MAX_HEARTS)
    : DEFAULT_MAX_HEARTS;
  const hearts = enabled ? (heartsQuery.data?.hearts ?? maxHearts) : maxHearts;
  const nextHeartInSecondsRaw = enabled
    ? (heartsQuery.data?.next_heart_in_seconds ?? null)
    : null;

  return {
    heartsQuery,
    refetchHearts: heartsQuery.refetch,
    hearts,
    maxHearts,
    nextHeartInSecondsRaw,
    // UI overlay state (Zustand)
    isOutOfHeartsModalOpen,
    setOutOfHeartsModalOpen,
    outOfHeartsUntilTs,
    lastSeenServerHeartsTs,

    // Safe actions
    decrementHeart,
    grantHeartsSafe,
    refillHeartsSafe,

    decrementHeartsMutation: decrementMutation,
    grantHeartsMutation: grantMutation,
    refillHeartsMutation: refillMutation,
  };
}
