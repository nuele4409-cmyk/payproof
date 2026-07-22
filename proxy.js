import { NextResponse } from 'next/server';

function buildCorsHeaders(origin) {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  const allowed = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!isDev && allowed.length === 0) {
    return {
      'access-control-allow-origin':  '',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-Request-Id',
      'access-control-expose-headers': 'X-Request-Id',
      'access-control-max-age':       '86400',
    };
  }

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
    request.headers.get('x-request-id') ?? globalThis.crypto.randomUUID();

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
  response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  response.headers.set(
    'content-security-policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );
  response.headers.set(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
