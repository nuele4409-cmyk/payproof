import db from '../../../../lib/db.js';
import { getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import { ok, notFound, serverError } from '../../../../lib/apiResponse.js';

// Public buyer-facing product read. Writes moved to PUT /api/seller/me/product
// so sellers don't need to know their slug to save.
export async function GET(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;

    const product = await db.product.findFirst({
      where: {
        OR: [
          { slug: id },
          ...(isNaN(Number(id)) ? [] : [{ id: Number(id) }]),
        ],
      },
      include: { seller: { select: { name: true, store: true, verified: true } } },
    });

    if (!product) return notFound('Product not found.');

    logger.debug('Product fetched', { productSlug: product.slug, requestId });

    const s = product.seller;
    return ok({
      id:          product.slug,
      name:        product.name,
      price:       product.price,
      description: product.description,
      image:       product.image ?? null,
      seller: s ? {
        name:     s.name,
        store:    s.store ?? `${s.name}'s Store`,
        verified: !!s.verified,
      } : null,
    });
  } catch (err) {
    return serverError(err, 'GET /api/products/[id]', requestId);
  }
}
