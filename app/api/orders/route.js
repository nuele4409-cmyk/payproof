import { authenticate, getRequestId } from '../../../lib/authHelpers.js';
import { createOrder, listOrders } from '../../../lib/orderService.js';
import { logger } from '../../../lib/logger.js';
import { checkRateLimit, tooManyRequests, clientIp } from '../../../lib/rateLimit.js';
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

  const ip = clientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(
    `order:create:${ip}`,
    20,
    60_000
  );
  if (!allowed) {
    logger.warn('Order creation rate limit exceeded', { ip, requestId });
    return tooManyRequests(retryAfterMs);
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { buyerName, productSlug, phone } = body;

    if (!buyerName?.trim()) return badRequest('buyerName is required.');
    if (!productSlug?.trim()) return badRequest('productSlug is required.');

    // The seller is derived from the product — no separate sellerContact
    // lookup, since each product already belongs to exactly one seller.
    const product = await db.product.findUnique({
      where: { slug: productSlug.trim() },
    });
    if (!product) return badRequest('That listing does not exist.');

    // If the buyer is authenticated, record their userId so
    // confirm-delivery can verify they are the actual buyer.
    const user = authenticate(request);

    const order = await createOrder({
      buyerName:   buyerName.trim(),
      sellerId:    product.sellerId,
      productSlug: product.slug,
      phone:       phone?.trim() || null,
      buyerId:     user?.sub ?? null,
    });

    logger.info('Order created via API', {
      orderId:  order.id,
      sellerId: product.sellerId,
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
