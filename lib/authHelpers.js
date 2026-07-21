import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from './logger.js';

const JWT_EXPIRY = '7d';

export function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[PayProof] JWT_SECRET is not set in environment variables.'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      '[PayProof] JWT_SECRET must be at least 32 characters long.'
    );
  }

  return jwt.sign(
    {
      sub:  payload.id,
      role: payload.role,
      name: payload.name,
    },
    secret,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token) {
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[PayProof] JWT_SECRET is not set in environment variables.'
    );
  }

  try {
    return jwt.verify(token, secret);
  } catch (err) {
    logger.debug('JWT verification failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function extractToken(request) {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function authenticate(request) {
  return verifyToken(extractToken(request));
}

export function getRequestId(request) {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}
