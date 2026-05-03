import 'server-only';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new Error('Too many requests. Please wait a minute and try again.');
  }

  bucket.count += 1;
}
