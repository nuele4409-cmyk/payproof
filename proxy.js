import { NextResponse } from 'next/server';

function buildCorsHeaders(origin) {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  const allowed = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowOrigin =
    allowed.length === 0 || allowed.includes(origin) ? origin || '*' : '';

  return {
    'access-control-allow-origin':  allowOrigin,
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Request-Id',
    'access-control-expose-headers': 'X-Request-Id',
    'access-control-max-age':       '86400',
  };
}

export function proxy(request) {
  const origin    = request.headers.get('origin') ?? '';
  const corsHdrs  = buildCorsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status:  204,
      headers: corsHdrs,
    });
  }

  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const [key, value] of Object.entries(corsHdrs)) {
    response.headers.set(key, value);
  }

  response.headers.set('x-request-id', requestId);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
