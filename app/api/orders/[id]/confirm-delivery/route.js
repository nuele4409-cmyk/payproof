import { authenticate, getRequestId } from '../../../../../lib/authHelpers.js';
import { advanceState } from '../../../../../lib/orderService.js';
import { logger } from '../../../../../lib/logger.js';
import db from '../../../../../lib/db.js';
import {
  ok,
  unauthorized,
  notFound,
  badRequest,
  serverError,
} from '../../../../../lib/apiResponse.js';

export async function POST(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();

    const { id } = await params;

    const dbOrder = await db.order.findUnique({ where: { id } });
    if (!dbOrder) return notFound(`Order ${id} not found.`);

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
      userId:  user.sub,
      role:    user.role,
      requestId,
    });

    return ok(completed);
  } catch (err) {
    return serverError(err, 'POST /api/orders/[id]/confirm-delivery', requestId);
  }
}
