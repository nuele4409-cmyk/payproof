import { isSandbox } from '../../../../lib/monnifyClient.js';
import { handleNotification } from '../webhook/route.js';
import { logger } from '../../../../lib/logger.js';
import db from '../../../../lib/db.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isSandbox()) {
    return Response.json(
      { error: 'This endpoint is only available in sandbox mode.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json(
        { error: 'Request body must be JSON.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { transactionReference } = body;
    if (!transactionReference) {
      return Response.json(
        { error: 'transactionReference is required.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const event = await db.webhookEvent.findUnique({
      where: { id: transactionReference },
    });

    if (!event) {
      return Response.json(
        { error: 'No webhook event found for this reference.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (event.processed) {
      // Reset to allow re-processing
      await db.webhookEvent.update({
        where: { id: transactionReference },
        data:  { processed: false },
      });
    }

    logger.info('Webhook replay triggered', { transactionReference });

    await handleNotification(transactionReference, event.payload, false);

    return Response.json({ status: 'ok', transactionReference });
  } catch (err) {
    logger.error('Webhook replay failed', { err });
    return Response.json(
      { error: 'Replay failed.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
