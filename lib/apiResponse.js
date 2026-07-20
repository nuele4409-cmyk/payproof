import { logger } from './logger.js';

export function ok(data, status = 200) {
  return Response.json(data, { status });
}

export function badRequest(message, code = 'VALIDATION_ERROR') {
  return Response.json({ error: message, code }, { status: 400 });
}

export function unauthorized(message = 'Authentication required.') {
  return Response.json(
    { error: message, code: 'AUTH_REQUIRED' },
    { status: 401 }
  );
}

export function forbidden(message = 'You do not have permission to do that.') {
  return Response.json(
    { error: message, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

export function notFound(message = 'Not found.') {
  return Response.json(
    { error: message, code: 'NOT_FOUND' },
    { status: 404 }
  );
}

export function conflict(message) {
  return Response.json(
    { error: message, code: 'CONFLICT' },
    { status: 409 }
  );
}

export function serverError(err, context = '', requestId) {
  logger.error('Unhandled server error', {
    context,
    requestId,
    err: err instanceof Error ? err : new Error(String(err)),
  });

  return Response.json(
    {
      error:     'Something went wrong. Please try again.',
      code:      'INTERNAL_ERROR',
      requestId: requestId ?? undefined,
    },
    { status: 500 }
  );
}
