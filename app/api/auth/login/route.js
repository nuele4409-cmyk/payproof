import bcrypt from 'bcrypt';
import db from '../../../../lib/db.js';
import { signToken, getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import { checkRateLimit, tooManyRequests, clientIp } from '../../../../lib/rateLimit.js';
import { ok, badRequest, unauthorized, serverError } from '../../../../lib/apiResponse.js';

export async function POST(request) {
  const requestId = getRequestId(request);

  const ip = clientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(
    `login:${ip}`,
    10,
    60_000
  );

  if (!allowed) {
    logger.warn('Login rate limit exceeded', { ip, requestId });
    return tooManyRequests(retryAfterMs);
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { contact, password } = body;

    if (!contact?.trim()) return badRequest('contact is required.');
    if (!password)        return badRequest('password is required.');

    const user = await db.user.findUnique({
      where: { contact: contact.trim().toLowerCase() },
    });

    const DUMMY_HASH =
      '$2b$12$invalidhashusedtoblindthetimingXXXXXXXXXXXXXXXXXX';

    const passwordMatch = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH
    );

    if (!user || !passwordMatch) {
      logger.warn('Login failed — invalid credentials', {
        contact: contact.trim().toLowerCase(),
        requestId,
      });
      return unauthorized('Invalid email or password.');
    }

    const token = signToken({ id: user.id, role: user.role, name: user.name });

    logger.info('User logged in', { userId: user.id, role: user.role, requestId });

    return ok({ user: { name: user.name, role: user.role }, token });
  } catch (err) {
    return serverError(err, 'POST /api/auth/login', requestId);
  }
}
