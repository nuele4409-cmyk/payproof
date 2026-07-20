const store = new Map();

export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;
  const allowed      = bucket.count <= limit;
  const remaining    = Math.max(0, limit - bucket.count);
  const retryAfterMs = bucket.resetAt - now;

  return { allowed, remaining, retryAfterMs };
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

const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

pruneTimer.unref?.();
