import { isSandbox } from '../../../../lib/monnifyClient.js';
import { advanceState, findPendingOrderBySeller, runFraudCheck } from '../../../../lib/orderService.js';
import { logger } from '../../../../lib/logger.js';
import db from '../../../../lib/db.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isSandbox()) {
    return Response.json(
      { error: 'This endpoint is only available in sandbox mode.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json(
        { error: 'Request body must be JSON.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { orderId, sellerId, amount } = body;

    let order = null;

    if (orderId) {
      order = await db.order.findUnique({ where: { id: orderId } });
    } else if (sellerId && amount) {
      order = await findPendingOrderBySeller(Number(sellerId), Number(amount));
    }

    if (!order) {
      return Response.json(
        { error: 'No matching pending order found.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (order.state !== 'PendingPayment') {
      return Response.json(
        { error: `Order is "${order.state}", not PendingPayment.`, code: 'INVALID_STATE' },
        { status: 400 }
      );
    }

    const paidAmount = amount ?? order.amount;

    const seller = await db.user.findUnique({ where: { id: order.sellerId } });
    const { flagged, flagReason } = runFraudCheck(paidAmount, seller?.typicalOrder);

    const transactionRef = `SIM-${order.id}-${Date.now()}`;

    await db.$transaction(async (tx) => {
      await advanceState(order.id, 'Paid', { ref: transactionRef, flagged, flagReason }, tx);
      await advanceState(order.id, 'AwaitingShipment', {}, tx);
    });

    logger.info('Sandbox payment simulated', {
      orderId: order.id,
      transactionRef,
      amount: paidAmount,
      flagged,
    });

    return Response.json({
      status: 'ok',
      orderId: order.id,
      transactionRef,
      amount: paidAmount,
      flagged,
      flagReason: flagReason ?? null,
    }, { status: 200 });
  } catch (err) {
    logger.error('Sandbox simulation failed', { err });
    return Response.json(
      { error: 'Simulation failed.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
