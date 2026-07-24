import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import Constants from "expo-constants";
import { queryClient } from "@garzoni/core";

const DAY = 24 * 60 * 60 * 1000;

let initialized = false;

/**
 * Cold starts should paint last-known data instead of a spinner. The persister
 * writes the query cache to AsyncStorage; on relaunch `PersistQueryClientProvider`
 * restores it before any network call resolves.
 *
 * gcTime must be >= maxAge: react-query drops inactive queries from memory once
 * gcTime elapses, and a dropped query is never written to the persisted snapshot
 * even if it was cached recently. The default (30 min, set in @garzoni/core) is
 * far shorter than the 24h persistence window, so bump it here without touching
 * the other defaults (staleTime, retry, etc.) owned by the shared package.
 */
export function initQueryPersistMobile() {
  if (initialized) return;
  initialized = true;

  const current = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...current,
    queries: {
      ...current.queries,
      gcTime: Math.max(current.queries?.gcTime ?? 0, DAY),
    },
  });
}

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "garzoni:query-cache",
});

/**
 * Bump `buster` (via app version) on breaking cache-shape changes to drop all
 * persisted caches at once. `queryClient` is intentionally omitted — the
 * `client` prop on `PersistQueryClientProvider` supplies it, and its type
 * (`OmitKeyof<PersistQueryClientOptions, "queryClient">`) forbids passing it here.
 */
export const queryPersistOptions = {
  persister: queryPersister,
  maxAge: DAY,
  buster: Constants.expoConfig?.version ?? "v1",
};
