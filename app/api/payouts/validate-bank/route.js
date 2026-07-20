import { authenticate, getRequestId } from '../../../../lib/authHelpers.js';
import { validateBankAccount } from '../../../../lib/monnifyClient.js';
import { logger } from '../../../../lib/logger.js';
import {
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from '../../../../lib/apiResponse.js';

export async function POST(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('Only sellers can validate bank accounts.');
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { bankCode, accountNumber } = body;
    if (!bankCode?.trim()) return badRequest('bankCode is required.');
    if (!accountNumber?.trim()) return badRequest('accountNumber is required.');

    const result = await validateBankAccount(bankCode.trim(), accountNumber.trim());

    logger.info('Bank account validated via endpoint', {
      userId: user.sub,
      bankCode,
      accountNumber: result.accountNumber,
      accountName: result.accountName,
      requestId,
    });

    return ok({
      bankCode: result.bankCode,
      accountNumber: result.accountNumber,
      accountName: result.accountName,
    });
  } catch (err) {
    if (err.message?.includes('failed')) {
      return badRequest('Could not validate this account. Check the bank code and account number.');
    }
    return serverError(err, 'POST /api/payouts/validate-bank', requestId);
  }
}
