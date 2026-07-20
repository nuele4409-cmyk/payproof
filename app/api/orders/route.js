import { authenticate, getRequestId } from '../../../lib/authHelpers.js';
import { createOrder, listOrders } from '../../../lib/orderService.js';
import { logger } from '../../../lib/logger.js';
import {
  ok,
  badRequest,
  unauthorized,
  serverError,
} from '../../../lib/apiResponse.js';
import db from '../../../lib/db.js';

export async function GET(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();

    const orders = await listOrders({ sellerId: user.sub });

    logger.info('Orders listed', {
      userId: user.sub,
      count:  orders.length,
      requestId,
    });

    return ok(orders);
  } catch (err) {
    return serverError(err, 'GET /api/orders', requestId);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { buyerName, productSlug, sellerContact } = body;

    if (!buyerName?.trim()) {
      return badRequest('buyerName is required.');
    }
    if (!productSlug?.trim()) {
      return badRequest('productSlug is required (e.g. "aj1-low").');
    }

    let sellerId;
    if (sellerContact) {
      const seller = await db.user.findUnique({
        where: { contact: sellerContact.trim().toLowerCase() },
      });
      if (!seller || seller.role !== 'seller') {
        return badRequest('No seller found with that contact.');
      }
      sellerId = seller.id;
    } else {
      const seller = await db.user.findFirst({ where: { role: 'seller' } });
      if (!seller) return badRequest('No seller account found.');
      sellerId = seller.id;
    }

    const order = await createOrder({
      buyerName:   buyerName.trim(),
      sellerId,
      productSlug: productSlug.trim(),
    });

    logger.info('Order created via API', {
      orderId:  order.id,
      sellerId,
      amount:   order.amount,
      requestId,
    });

    return ok({ order }, 201);
  } catch (err) {
    if (err.message === 'PRODUCT_NOT_FOUND') {
      return badRequest('No product found for this seller.');
    }
    return serverError(err, 'POST /api/orders', requestId);
  }
}
