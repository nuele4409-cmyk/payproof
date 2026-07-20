import { getOrder } from '../../../../lib/orderService.js';
import { getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import { ok, notFound, serverError } from '../../../../lib/apiResponse.js';
import db from '../../../../lib/db.js';

export async function GET(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;
    const order  = await getOrder(id);

    if (!order) {
      logger.warn('Order not found', { orderId: id, requestId });
      return notFound(`Order ${id} not found.`);
    }

    // Attach the seller display info the buyer-facing pay page and order
    // timeline render — the seller's reserved account (where the buyer sent
    // the money) and the masked settlement account (where it settles). Kept
    // narrow: only what the UI already surfaces.
    const dbOrder = await db.order.findUnique({
      where:  { id },
      select: {
        sellerId: true,
        seller: {
          select: {
            name: true, store: true, verified: true,
            reservedBank: true, reservedNumber: true, reservedName: true,
            settlementBank: true, settlementNumber: true, settlementName: true,
          },
        },
      },
    });

    const s = dbOrder?.seller;
    const seller = s ? {
      name:     s.name,
      store:    s.store ?? `${s.name}'s Store`,
      verified: !!s.verified,
      account:  s.reservedNumber ? {
        bank:   s.reservedBank,
        number: s.reservedNumber,
        name:   s.reservedName,
      } : null,
      settlement: s.settlementNumber ? {
        bank:   s.settlementBank,
        masked: `••••${s.settlementNumber.slice(-4)}`,
        name:   s.settlementName,
      } : null,
    } : null;

    logger.debug('Order fetched', { orderId: id, state: order.state, requestId });

    return ok({ ...order, seller });
  } catch (err) {
    return serverError(err, 'GET /api/orders/[id]', requestId);
  }
}
