import { authenticate, getRequestId } from '../../../../../lib/authHelpers.js';
import { advanceState } from '../../../../../lib/orderService.js';
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

    const { id } = await params;

    const dbOrder = await db.order.findUnique({ where: { id } });
    if (!dbOrder) return notFound(`Order ${id} not found.`);

    const isAnonymous = dbOrder.buyerId === null;

    if (user && dbOrder.sellerId === user.sub) {
      return forbidden('Sellers cannot confirm delivery on their own orders.');
    }

    if (!isAnonymous) {
      if (!user) return unauthorized();
      if (dbOrder.buyerId !== user.sub) {
        return forbidden('Only the buyer who placed this order can confirm delivery.');
      }
    }

    let completed;
    try {
      completed = await db.$transaction(async (tx) => {
        await advanceState(id, 'Delivered',  {}, tx);
        return advanceState(id, 'Completed', {}, tx);
      });
    } catch (transitionErr) {
      if (transitionErr.message?.startsWith('INVALID_TRANSITION')) {
        return badRequest(
          'This order cannot be confirmed in its current state. ' +
          `It is currently "${dbOrder.state}".`
        );
      }
      if (transitionErr.message === 'ORDER_NOT_FOUND') {
        return notFound('Order not found.');
      }
      throw transitionErr;
    }

    logger.info('Delivery confirmed', {
      orderId: id,
      userId:  user?.sub ?? null,
      role:    user?.role ?? 'anonymous',
      requestId,
    });

    return ok(completed);
  } catch (err) {
    return serverError(err, 'POST /api/orders/[id]/confirm-delivery', requestId);
  }
}
