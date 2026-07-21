import db from '../../../../../lib/db.js';
import { authenticate, getRequestId } from '../../../../../lib/authHelpers.js';
import { logger } from '../../../../../lib/logger.js';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from '../../../../../lib/apiResponse.js';

// One product per seller (single-listing MVP). This endpoint is the
// seller's own view of their listing — the buyer-facing route
// GET /api/products/:slug takes the slug from the URL, but sellers
// don't need to know their slug to save; the backend derives it from
// their user id on first save.

function slugForSeller(userId) {
  return `store-${userId}`;
}

export async function GET(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('This endpoint is for sellers only.');
    }

    const product = await db.product.findFirst({
      where: { sellerId: user.sub },
    });

    if (!product) return ok(null);

    return ok({
      id:          product.slug,
      name:        product.name,
      price:       product.price,
      description: product.description,
      image:       product.image ?? null,
    });
  } catch (err) {
    return serverError(err, 'GET /api/seller/me/product', requestId);
  }
}

export async function PUT(request) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('Only sellers can save listings.');
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { name, price, description, image } = body;

    if (!name?.trim()) return badRequest('name is required.');
    if (price === undefined || price === null) return badRequest('price is required.');
    if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0) {
      return badRequest('price must be a positive integer (naira).');
    }
    if (!description?.trim()) return badRequest('description is required.');

    if (image !== undefined && image !== null) {
      if (typeof image !== 'string') {
        return badRequest('image must be a data URL string.');
      }
      if (!image.startsWith('data:image/')) {
        return badRequest('image must be a data URL (data:image/...).');
      }
      if (image.length > 700_000) {
        return badRequest('image must be under 700KB.');
      }
      if (image.length > 100_000) {
        logger.warn('Product image is large for a data URL', {
          userId: user.sub,
          sizeKB: Math.round(image.length / 1000),
          requestId,
        });
      }
    }

    const existing = await db.product.findFirst({ where: { sellerId: user.sub } });
    const slug     = existing?.slug ?? slugForSeller(user.sub);

    const product = await db.product.upsert({
      where:  { slug },
      create: {
        slug,
        name:        name.trim(),
        price,
        description: description.trim(),
        image:       image ?? null,
        sellerId:    user.sub,
      },
      update: {
        name:        name.trim(),
        price,
        description: description.trim(),
        image:       image ?? null,
      },
    });

    // Single-listing MVP: fraud check compares each payment to the seller's
    // typical order size; with one product per seller, "typical" == its price.
    await db.user.update({
      where: { id: user.sub },
      data:  { typicalOrder: price },
    });

    logger.info('Seller product saved', {
      slug:     product.slug,
      sellerId: user.sub,
      created:  !existing,
      requestId,
    });

    return ok({
      id:          product.slug,
      name:        product.name,
      price:       product.price,
      description: product.description,
      image:       product.image ?? null,
    });
  } catch (err) {
    return serverError(err, 'PUT /api/seller/me/product', requestId);
  }
}
