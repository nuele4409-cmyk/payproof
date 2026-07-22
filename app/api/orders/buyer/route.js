import { authenticate, getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import { ok, unauthorized, serverError } from '../../../../lib/apiResponse.js';
import db from '../../../../lib/db.js';

export async function GET(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'buyer') {
      return Response.json(
        { error: 'Only buyers can view their order list.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const orders = await db.order.findMany({
      where:   { buyerId: user.sub },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('Buyer orders listed', {
      userId: user.sub,
      count:  orders.length,
      requestId,
    });

    return ok(orders);
  } catch (err) {
    return serverError(err, 'GET /api/orders/buyer', requestId);
  }
}
