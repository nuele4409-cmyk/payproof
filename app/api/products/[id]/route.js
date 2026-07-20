import db from '../../../../lib/db.js';
import { authenticate, getRequestId } from '../../../../lib/authHelpers.js';
import { logger } from '../../../../lib/logger.js';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from '../../../../lib/apiResponse.js';

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
    });

    if (!product) return notFound('Product not found.');

    logger.debug('Product fetched', { productSlug: product.slug, requestId });

    return ok({
      id:          product.slug,
      name:        product.name,
      price:       product.price,
      description: product.description,
      image:       product.image ?? null,
    });
  } catch (err) {
    return serverError(err, 'GET /api/products/[id]', requestId);
  }
}

export async function PUT(request, { params }) {
  const requestId = getRequestId(request);

  try {
    const user = authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'seller') {
      return forbidden('Only sellers can update products.');
    }

    const { id } = await params;
    const body   = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be JSON.');
    }

    const { name, price, description, image } = body;

    if (!name?.trim())                 return badRequest('name is required.');
    if (price === undefined || price === null) return badRequest('price is required.');
    if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0) {
      return badRequest('price must be a positive integer (naira).');
    }
    if (!description?.trim())          return badRequest('description is required.');

    const existing = await db.product.findUnique({ where: { slug: id } });
    if (existing && existing.sellerId !== user.sub) {
      return forbidden('You can only update your own product.');
    }

    const product = await db.product.upsert({
      where:  { slug: id },
      create: {
        slug:        id,
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

    logger.info('Product upserted', {
      productSlug: product.slug,
      sellerId:    user.sub,
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
    return serverError(err, 'PUT /api/products/[id]', requestId);
  }
}
