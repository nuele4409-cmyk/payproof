import db from '../../../../../lib/db.js';
import { authenticate, getRequestId } from '../../../../../lib/authHelpers.js';
import { validateBankAccount } from '../../../../../lib/monnifyClient.js';
import { logger } from '../../../../../lib/logger.js';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from '../../../../../lib/apiResponse.js';

// Save the seller's settlement (payout) bank account. Validated against
// Monnify first so an unreachable/wrong account never gets stored — and so
// POST /api/payouts/release stops 400-ing on "no settlement account
// configured". The account name is taken from Monnify, not the caller.
export async function PUT(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('Only sellers can set a settlement account.');
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { bankCode, accountNumber } = body;
    if (!bankCode?.trim())      return badRequest('bankCode is required.');
    if (!accountNumber?.trim()) return badRequest('accountNumber is required.');

    let validated;
    try {
      validated = await validateBankAccount(bankCode.trim(), accountNumber.trim());
    } catch (validateErr) {
      logger.warn('Settlement account validation failed', {
        userId: user.sub,
        err:    validateErr,
        requestId,
      });
      return badRequest('Could not validate this account. Check the bank code and account number.');
    }

    await db.user.update({
      where: { id: user.sub },
      data: {
        settlementBank:   validated.bankCode,
        settlementNumber: validated.accountNumber,
        settlementName:   validated.accountName,
      },
    });

    logger.info('Settlement account set', {
      userId:         user.sub,
      bankCode:       validated.bankCode,
      accountName:    validated.accountName,
      requestId,
    });

    return ok({
      bank:   validated.bankCode,
      masked: `••••${validated.accountNumber.slice(-4)}`,
      name:   validated.accountName,
    });
  } catch (err) {
    return serverError(err, 'PUT /api/seller/me/settlement', requestId);
  }
}
