import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  defaultShouldDehydrateQuery,
  type Query,
  type QueryKey,
} from "@tanstack/react-query";
import Constants from "expo-constants";
import { queryClient } from "@garzoni/core";

const DAY = 24 * 60 * 60 * 1000;

/**
 * AsyncStorage is NOT encrypted, so query-key roots holding personal financial
 * data, PII, or account/billing state are kept OUT of the persisted snapshot.
 * Content and progress queries (courses, lessons, leaderboard, progressSummary)
 * still persist so cold starts paint instantly — only sensitive reads are excluded.
 *
 * Keep in sync with the sensitive keys in packages/core/src/lib/reactQuery.ts
 * (queryKeys). When adding a query that returns money figures, PII, or
 * entitlement/account state, add its root here.
 */
const SENSITIVE_QUERY_KEY_ROOTS = new Set<string>([
  "profile",
  "userSettings",
  "entitlements",
  "hearts",
  "portfolioDashboard",
  "savingsBalance",
  "coachBrief",
  "smartResume",
  "supportEntries",
  "referral-summary",
]);

function isSensitiveQueryKey(queryKey: QueryKey): boolean {
  const root = queryKey[0];
  return typeof root === "string" && SENSITIVE_QUERY_KEY_ROOTS.has(root);
}

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
  dehydrateOptions: {
    // Keep default behaviour (only successful queries) AND drop sensitive ones
    // so financial/PII/account data never lands in unencrypted AsyncStorage.
    shouldDehydrateQuery: (query: Query) =>
      defaultShouldDehydrateQuery(query) && !isSensitiveQueryKey(query.queryKey),
  },
};
