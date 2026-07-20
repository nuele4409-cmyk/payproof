import { authenticate, getRequestId } from '../../../../../lib/authHelpers.js';
import { validateBankAccount, singleTransfer } from '../../../../../lib/monnifyClient.js';
import { logger } from '../../../../../lib/logger.js';
import db from '../../../../../lib/db.js';
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '../../../../../lib/apiResponse.js';

export async function POST(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('Only sellers can release funds.');
    }

    const { id } = await params;

    const order = await db.order.findUnique({ where: { id } });
    if (!order) return notFound('Order not found.');
    if (order.sellerId !== user.sub) {
      return forbidden('You can only release funds for your own orders.');
    }
    if (order.state !== 'Completed') {
      return badRequest(`Order must be Completed before release. Current state: "${order.state}".`);
    }

    const seller = await db.user.findUnique({ where: { id: user.sub } });
    if (!seller) return notFound('Seller not found.');
    if (!seller.settlementBank || !seller.settlementNumber) {
      return badRequest('No settlement bank account configured. Add one in your profile.');
    }

    const validated = await validateBankAccount(
      seller.settlementBank,
      seller.settlementNumber
    );

    const sourceAccount = process.env.MONNIFY_WALLET_ACCOUNT_NUMBER;
    if (!sourceAccount) {
      return serverError(
        new Error('MONNIFY_WALLET_ACCOUNT_NUMBER not configured'),
        'POST /api/payouts/release',
        requestId
      );
    }

    const payoutRef = `PAYOUT-${order.id}-${Date.now()}`;

    const transfer = await singleTransfer({
      amount: order.amount,
      reference: payoutRef,
      narration: `PayProof payout for order ${order.id}`,
      destinationBankCode: seller.settlementBank,
      destinationAccountNumber: seller.settlementNumber,
      destinationAccountName: validated.accountName,
      sourceAccountNumber: sourceAccount,
    });

    await db.order.update({
      where: { id },
      data: {
        timestamps: {
          ...(order.timestamps ?? {}),
          PayoutSent: new Date().toISOString(),
          payoutRef,
        },
      },
    });

    logger.info('Payout released', {
      orderId: order.id,
      sellerId: user.sub,
      amount: order.amount,
      payoutRef,
      transferStatus: transfer.status,
      requestId,
    });

    return ok({
      orderId: order.id,
      amount: order.amount,
      payoutRef,
      transferStatus: transfer.status,
      destinationBank: seller.settlementBank,
      destinationAccount: seller.settlementNumber,
      destinationName: validated.accountName,
    });
  } catch (err) {
    if (err.message?.startsWith('[Monnify]')) {
      return serverError(err, 'POST /api/payouts/release', requestId);
    }
    return serverError(err, 'POST /api/payouts/release', requestId);
  }
}
