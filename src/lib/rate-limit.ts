// Best-effort per-IP limiter held in memory. On serverless each instance has its own
// counts, so this stops casual repeat submissions rather than a determined attacker.
const hits = new Map<string, number[]>();

/** Returns true if the request is allowed, false if the key has used up its allowance. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  hits.set(key, [...recent, now]);

  // Keep memory bounded: drop keys with no recent activity.
  if (hits.size > 1000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}
