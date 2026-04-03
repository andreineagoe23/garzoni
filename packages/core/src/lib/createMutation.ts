/**
 * Standardized mutation strategy:
 * - Optional optimistic updates in onMutate (return context)
 * - Cache updates via updateQueryData (if mutation returns authoritative payload)
 * - Targeted invalidation via invalidate (queryKeys.*())
 *
 * This helps avoid "invalidate too much / too little" drift over time.
 */
import { QueryClient } from "@tanstack/react-query";

type MutationOptionsArgs = {
  queryClient: QueryClient;
  mutationFn: (variables?: unknown) => Promise<unknown>;
  invalidate?: Array<unknown>;
  updateQueryData?: (
    queryClient: QueryClient,
    data: unknown,
    variables: unknown,
    context: unknown
  ) => void;
  onMutate?: (variables: unknown) => Promise<unknown> | unknown;
  onError?: (
    error: unknown,
    variables: unknown,
    context: unknown
  ) => Promise<void> | void;
  onSuccess?: (
    data: unknown,
    variables: unknown,
    context: unknown
  ) => Promise<void> | void;
  onSettled?: (
    data: unknown,
    error: unknown,
    variables: unknown,
    context: unknown
  ) => Promise<void> | void;
};

export function createMutationOptions({
  queryClient,
  mutationFn,
  invalidate = [],
  updateQueryData,
  onMutate,
  onError,
  onSuccess,
  onSettled,
}: MutationOptionsArgs) {
  if (!queryClient) {
    throw new Error("createMutationOptions requires a queryClient");
  }
  if (typeof mutationFn !== "function") {
    throw new Error("createMutationOptions requires a mutationFn");
  }

  const resolveKeys = (variables: unknown) =>
    (invalidate || [])
      .map((k) => (typeof k === "function" ? k(variables) : k))
      .filter(Boolean);

  return {
    mutationFn,
    onMutate: async (variables: unknown) => {
      return onMutate ? await onMutate(variables) : undefined;
    },
    onSuccess: async (data: unknown, variables: unknown, context: unknown) => {
      if (typeof updateQueryData === "function") {
        updateQueryData(queryClient, data, variables, context);
      }

      const keys = resolveKeys(variables);
      if (keys.length) {
        await Promise.all(
          keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
        );
      }

      if (onSuccess) {
        await onSuccess(data, variables, context);
      }
    },
    onError: async (error: unknown, variables: unknown, context: unknown) => {
      if (onError) {
        await onError(error, variables, context);
      }
    },
    onSettled: async (
      data: unknown,
      error: unknown,
      variables: unknown,
      context: unknown
    ) => {
      if (onSettled) {
        await onSettled(data, error, variables, context);
      }
    },
  };
}
