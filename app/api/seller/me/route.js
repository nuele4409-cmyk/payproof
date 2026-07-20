import db from '../../../../lib/db.js';
import { authenticate, getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from '../../../../lib/apiResponse.js';

export async function GET(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('This endpoint is for sellers only.');
    }

    const [seller, product] = await Promise.all([
      db.user.findUnique({ where: { id: user.sub } }),
      db.product.findFirst({ where: { sellerId: user.sub }, select: { slug: true } }),
    ]);
    if (!seller) return notFound('Seller account not found.');

    const maskedSettlement = seller.settlementNumber
      ? `••••${seller.settlementNumber.slice(-4)}`
      : null;

    logger.debug('Seller profile fetched', { userId: user.sub, requestId });

    return ok({
      name:     seller.name,
      store:    seller.store ?? `${seller.name}'s Store`,
      verified: seller.verified,

      account: seller.reservedNumber
        ? {
            bank:   seller.reservedBank,
            number: seller.reservedNumber,
            name:   seller.reservedName,
          }
        : null,

      settlement: seller.settlementNumber
        ? {
            bank:   seller.settlementBank,
            masked: maskedSettlement,
            name:   seller.settlementName,
          }
        : null,

      typicalOrder:   seller.typicalOrder ?? null,
      storefrontSlug: product?.slug ?? null,
    });
  } catch (err) {
    return serverError(err, 'GET /api/seller/me', requestId);
  }
}
