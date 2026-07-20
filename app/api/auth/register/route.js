import bcrypt from 'bcrypt';
import db from '../../../../lib/db.js';
import { signToken, getRequestId } from '../../../../lib/authHelpers.js';
import { createReservedAccount } from '../../../../lib/monnifyClient.js';
import { logger } from '../../../../lib/logger.js';
import { checkRateLimit, tooManyRequests, clientIp } from '../../../../lib/rateLimit.js';
import {
  ok,
  badRequest,
  conflict,
  serverError,
} from '../../../../lib/apiResponse.js';

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

export async function POST(request) {
  const requestId = getRequestId(request);

  const ip      = clientIp(request);
  const { allowed, remaining, retryAfterMs } = checkRateLimit(
    `register:${ip}`,
    5,
    15 * 60_000
  );

  if (!allowed) {
    logger.warn('Register rate limit exceeded', { ip, requestId });
    return tooManyRequests(retryAfterMs);
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { name, contact, password, role, bvn } = body;

    if (!name?.trim())    return badRequest('name is required.');
    if (!contact?.trim()) return badRequest('contact is required.');
    if (!password)        return badRequest('password is required.');

    if (role !== 'seller' && role !== 'buyer') {
      return badRequest('role must be "seller" or "buyer".');
    }

    if (!EMAIL_RE.test(contact.trim())) {
      return badRequest(
        'contact must be a valid email address. ' +
        'PayProof uses your email to set up your payment account.'
      );
    }

    if (password.length < 8) {
      return badRequest('password must be at least 8 characters.');
    }

    const cleanName    = name.trim();
    const cleanContact = contact.trim().toLowerCase();

    const existing = await db.user.findUnique({
      where: { contact: cleanContact },
    });
    if (existing) {
      return conflict('An account with this email already exists. Please log in.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user;
    try {
      user = await db.user.create({
        data: {
          name:        cleanName,
          contact:     cleanContact,
          passwordHash,
          role,
          store:       role === 'seller' ? `${cleanName}'s Store` : null,
          verified:    false,
        },
      });
    } catch (createErr) {
      if (createErr.code === 'P2002') {
        return conflict('An account with this email already exists. Please log in.');
      }
      throw createErr;
    }

    logger.info('User registered', { userId: user.id, role, requestId });

    const token = signToken({ id: user.id, role: user.role, name: user.name });

    let account = null;
    if (role === 'seller') {
      try {
        const reserved = await createReservedAccount({
          userId:  user.id,
          name:    user.name,
          contact: user.contact,
          bvn:     bvn?.trim(),
        });

        await db.user.update({
          where: { id: user.id },
          data: {
            reservedBank:   reserved.bank,
            reservedNumber: reserved.number,
            reservedName:   reserved.name,
          },
        });

        account = reserved;
      } catch (monnifyErr) {
        logger.error('Monnify reserved account creation failed — registration continues', {
          userId: user.id,
          err:    monnifyErr,
          requestId,
        });
      }
    }

    const responseUser = { name: user.name, role: user.role };

    if (role === 'seller' && account) {
      responseUser.account = {
        bank:   account.bank,
        number: account.number,
        name:   account.name,
      };
    }

    return ok({ user: responseUser, token }, 201);
  } catch (err) {
    return serverError(err, 'POST /api/auth/register', requestId);
  }
}
