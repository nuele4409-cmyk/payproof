import { authenticate, getRequestId } from '../../../../../lib/authHelpers.js';
import { advanceState } from '../../../../../lib/orderService.js';
import { logger } from '../../../../../lib/logger.js';
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '../../../../../lib/apiResponse.js';
import db from '../../../../../lib/db.js';

export async function POST(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('Only sellers can mark orders as shipped.');
    }

    const { id } = await params;

    const dbOrder = await db.order.findUnique({ where: { id } });
    if (!dbOrder) return notFound(`Order ${id} not found.`);

    if (dbOrder.sellerId !== user.sub) {
      return forbidden('You can only mark your own orders as shipped.');
    }

    const updated = await advanceState(id, 'Shipped');

    logger.info('Order marked as shipped', {
      orderId:  id,
      sellerId: user.sub,
      requestId,
    });

    return ok(updated);
  } catch (err) {
    if (err.message?.startsWith('INVALID_TRANSITION')) {
      return badRequest(
        'This order cannot be marked as shipped in its current state.'
      );
    }
    if (err.message === 'ORDER_NOT_FOUND') return notFound('Order not found.');
    return serverError(err, 'POST /api/orders/[id]/ship', requestId);
  }
}
