// Rate limiting with two backends:
//
//   1) Upstash Redis (used when UPSTASH_REDIS_REST_URL is set) — safe on
//      serverless because the counter lives in Redis, not per-instance memory.
//      Required for Vercel/Cloudflare/etc.
//
//   2) In-memory Map (fallback) — for local dev, tests, or a single
//      long-lived Node host. Resets on every cold start, so DO NOT rely on
//      it in production serverless.
//
// Public shape (checkRateLimit / tooManyRequests / clientIp) is the same
// either way, so route handlers don't need to know which backend is active.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// A shared Redis client across all limiter instances. Instantiated once
// per module load; module scope is the correct cache boundary in Next.js
// route handlers.
let _redis = null;
function redis() {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

// One Ratelimit per (limit, windowMs) pair. Sliding window matches what
// the in-memory version was doing (single bucket per key, reset when
// resetAt passes) closely enough for auth-endpoint protection.
const _limiterCache = new Map();
function upstashLimiter(limit, windowMs) {
  const key = `${limit}:${windowMs}`;
  let l = _limiterCache.get(key);
  if (!l) {
    l = new Ratelimit({
      redis:     redis(),
      limiter:   Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: false,
      prefix:    'payproof-ratelimit',
    });
    _limiterCache.set(key, l);
  }
  return l;
}

// ——— in-memory backend ———

const _memStore = new Map();

function checkMemory(key, limit, windowMs) {
  const now = Date.now();
  let bucket = _memStore.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    _memStore.set(key, bucket);
  }

  bucket.count += 1;
  const allowed      = bucket.count <= limit;
  const remaining    = Math.max(0, limit - bucket.count);
  const retryAfterMs = bucket.resetAt - now;

  return { allowed, remaining, retryAfterMs };
}

const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _memStore) {
    if (now >= bucket.resetAt) _memStore.delete(key);
  }
}, 10 * 60 * 1000);

pruneTimer.unref?.();

// ——— public surface ———

export async function checkRateLimit(key, limit, windowMs) {
  if (useUpstash) {
    try {
      const res = await upstashLimiter(limit, windowMs).limit(key);
      return {
        allowed:      res.success,
        remaining:    res.remaining,
        // Upstash returns an absolute reset timestamp; convert to
        // relative ms so the response header code below stays uniform.
        retryAfterMs: Math.max(0, res.reset - Date.now()),
      };
    } catch (err) {
      // Fail open on Redis errors so a Redis outage doesn't turn into
      // an auth outage. Log via console because logger.js imports would
      // cycle. Same trade-off Upstash recommends.
      console.error(JSON.stringify({
        ts:    new Date().toISOString(),
        level: 'error',
        msg:   'rateLimit: Upstash failed, allowing request',
        error: err instanceof Error ? err.message : String(err),
      }));
      return { allowed: true, remaining: limit, retryAfterMs: 0 };
    }
  }
  return checkMemory(key, limit, windowMs);
}

export function tooManyRequests(retryAfterMs) {
  return Response.json(
    { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: {
        'Retry-After':      String(Math.ceil(retryAfterMs / 1000)),
        'X-RateLimit-Reset': String(Date.now() + retryAfterMs),
      },
    }
  );
}

export function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
