/**
 * Normalize list payloads from the API (raw array or DRF-style `{ results: T[] }`).
 */
export function unwrapApiList<T>(data: unknown): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && "results" in data) {
    const results = (data as { results: unknown }).results;
    if (Array.isArray(results)) return results as T[];
  }
  return [];
}
