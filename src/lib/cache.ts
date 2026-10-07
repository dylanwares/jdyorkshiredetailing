// Tiny in-memory TTL cache. Expired entries are kept so callers can serve stale
// data when a refresh fails (see cachedLoad).
interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();
// Refreshes that are running right now, so simultaneous requests share one fetch.
const inflight = new Map<string, Promise<unknown>>();

interface CachedLoadOptions<T> {
  key: string;
  ttlMs: number;
  /** After a failed refresh, wait this long before trying again. */
  retryMs: number;
  load: () => Promise<T>;
  /** Used when the refresh fails and there is no earlier good value. */
  fallback: T;
  /** Log the failure (never include request URLs: they can contain API keys). */
  onError: (error: unknown) => void;
}

/**
 * Cached value for `key`, refreshed with `load` when it has expired. If the refresh fails, the
 * last good value (or `fallback`) is served and the next attempt waits `retryMs`. Concurrent
 * callers share a single refresh instead of each hitting the remote service.
 */
export async function cachedLoad<T>({ key, ttlMs, retryMs, load, fallback, onError }: CachedLoadOptions<T>): Promise<T> {
  const entry = store.get(key) as Entry<T> | undefined;
  if (entry && entry.expires > Date.now()) return entry.value;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const refresh = (async () => {
    try {
      const value = await load();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } catch (error) {
      onError(error);
      const value = (store.get(key) as Entry<T> | undefined)?.value ?? fallback;
      store.set(key, { value, expires: Date.now() + retryMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, refresh);
  return refresh;
}
