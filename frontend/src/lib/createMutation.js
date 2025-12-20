/**
 * Standardized mutation strategy:
 * - Optional optimistic updates in onMutate (return context)
 * - Cache updates via updateQueryData (if mutation returns authoritative payload)
 * - Targeted invalidation via invalidate (queryKeys.*())
 *
 * This helps avoid “invalidate too much / too little” drift over time.
 */
export function createMutationOptions({
  queryClient,
  mutationFn,
  invalidate = [],
  updateQueryData,
  onMutate,
  onError,
  onSuccess,
  onSettled,
}) {
  if (!queryClient) {
    throw new Error("createMutationOptions requires a queryClient");
  }
  if (typeof mutationFn !== "function") {
    throw new Error("createMutationOptions requires a mutationFn");
  }

  const resolveKeys = (variables) =>
    (invalidate || [])
      .map((k) => (typeof k === "function" ? k(variables) : k))
      .filter(Boolean);

  return {
    mutationFn,
    onMutate: async (variables) => {
      return onMutate ? await onMutate(variables) : undefined;
    },
    onSuccess: async (data, variables, context) => {
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
    onError: async (error, variables, context) => {
      if (onError) {
        await onError(error, variables, context);
      }
    },
    onSettled: async (data, error, variables, context) => {
      if (onSettled) {
        await onSettled(data, error, variables, context);
      }
    },
  };
}
