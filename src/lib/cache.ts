// Tiny in-memory TTL cache. Expired entries are kept so callers can serve stale
// data when a refresh fails (see getStale).
interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export function getCache<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  return entry && entry.expires > Date.now() ? entry.value : undefined;
}

/** Last stored value for a key, even if it has expired. */
export function getStale<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}
