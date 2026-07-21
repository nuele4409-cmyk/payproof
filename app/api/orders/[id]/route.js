import { getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import { ok, notFound, serverError } from '../../../../lib/apiResponse.js';
import db from '../../../../lib/db.js';

export async function GET(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;

    const dbOrder = await db.order.findUnique({
      where:  { id },
      select: {
        id: true, ref: true, buyer: true, phone: true, item: true,
        amount: true, state: true, flagged: true, flagReason: true,
        timestamps: true,
        sellerId: true,
        seller: {
          select: {
            id: true,
            name: true, store: true, verified: true,
            reservedBank: true, reservedNumber: true, reservedName: true,
            settlementBank: true, settlementNumber: true, settlementName: true,
            products: { select: { slug: true }, take: 1 },
          },
        },
      },
    });

    if (!dbOrder) {
      logger.warn('Order not found', { orderId: id, requestId });
      return notFound(`Order ${id} not found.`);
    }

    const s = dbOrder.seller;
    const order = {
      id: dbOrder.id, ref: dbOrder.ref,
      buyer: dbOrder.buyer, phone: dbOrder.phone ?? undefined,
      item: dbOrder.item, amount: dbOrder.amount,
      state: dbOrder.state, flagged: dbOrder.flagged,
      flagReason: dbOrder.flagReason ?? undefined,
      timestamps: dbOrder.timestamps,
    };
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
      storefrontSlug: s.products?.[0]?.slug ?? null,
    } : null;

    logger.debug('Order fetched', { orderId: id, state: order.state, requestId });

    return ok({ ...order, seller });
  } catch (err) {
    return serverError(err, 'GET /api/orders/[id]', requestId);
  }
}
