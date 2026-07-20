import { getOrder } from '../../../../lib/orderService.js';
import { getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import { ok, notFound, serverError } from '../../../../lib/apiResponse.js';

export async function GET(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;
    const order  = await getOrder(id);

    if (!order) {
      logger.warn('Order not found', { orderId: id, requestId });
      return notFound(`Order ${id} not found.`);
    }

    logger.debug('Order fetched', { orderId: id, state: order.state, requestId });

    return ok(order);
  } catch (err) {
    return serverError(err, 'GET /api/orders/[id]', requestId);
  }
}
