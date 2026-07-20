import { verifyWebhookSignature, verifyTransaction } from '../../../../lib/monnifyClient.js';
import {
  advanceState,
  findPendingOrderBySeller,
  runFraudCheck,
} from '../../../../lib/orderService.js';
import { logger } from '../../../../lib/logger.js';
import db from '../../../../lib/db.js';

export const dynamic = 'force-dynamic';

const ACK = () => new Response('OK', { status: 200 });

export async function POST(request) {
  let rawBody;
  let payload;

  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn('Webhook: failed to parse request body');
    return ACK();
  }

  const isSandbox = (process.env.MONNIFY_BASE_URL ?? '').includes('sandbox');
  const signature = request.headers.get('monnify-signature');

  if (!isSandbox) {
    if (!signature) {
      logger.warn('Webhook: missing monnify-signature header — request rejected');
      return ACK();
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Webhook: invalid HMAC signature — possible spoofed request rejected');
      return ACK();
    }
  } else if (!signature) {
    logger.info('Webhook: sandbox mode — skipping HMAC verification (no header sent)');
  }

  const { eventType, eventData } = payload;

  if (eventType !== 'SUCCESSFUL_TRANSACTION') {
    logger.debug('Webhook: ignoring event type', { eventType });
    return ACK();
  }

  const transactionRef = eventData?.transactionReference;

  if (!transactionRef) {
    logger.error('Webhook: no transactionReference in eventData', { eventData });
    return ACK();
  }

  const existingEvent = await db.webhookEvent.findUnique({
    where: { id: transactionRef },
  });

  if (existingEvent?.processed) {
    logger.info('Webhook: duplicate event ignored', { transactionRef });
    return ACK();
  }

  const accountReference = eventData?.product?.reference ?? '';
  const sellerIdMatch    = accountReference.match(/^PAYPROOF-USER-(\d+)$/);

  if (!sellerIdMatch) {
    logger.error('Webhook: cannot parse sellerId from accountReference', {
      accountReference,
      transactionRef,
    });
    return ACK();
  }

  const sellerId = Number(sellerIdMatch[1]);
  const seller   = await db.user.findUnique({ where: { id: sellerId } });

  if (!seller) {
    logger.error('Webhook: seller not found', { sellerId, transactionRef });
    return ACK();
  }

  const pendingOrder = await findPendingOrderBySeller(sellerId);

  if (!pendingOrder) {
    logger.warn('Webhook: no pending order found for seller', {
      sellerId,
      transactionRef,
    });
    return ACK();
  }

  const amountPaid              = Math.round(Number(eventData.amountPaid ?? 0));
  const { flagged, flagReason } = runFraudCheck(amountPaid, seller.typicalOrder);

  if (flagged) {
    logger.warn('Webhook: fraud flag raised', {
      orderId: pendingOrder.id,
      transactionRef,
      flagReason,
    });
  }

  let verifiedStatus;
  let verifiedAmount;
  try {
    const verified = await verifyTransaction(transactionRef);
    verifiedStatus = verified.paymentStatus;
    verifiedAmount = verified.amountPaid;
  } catch (verifyErr) {
    logger.error('Webhook: Monnify API verification failed — rejecting', {
      transactionRef,
      err: verifyErr,
    });
    return ACK();
  }

  if (verifiedStatus !== 'PAID') {
    logger.error('Webhook: Monnify API reports payment not PAID', {
      transactionRef,
      paymentStatus: verifiedStatus,
    });
    return ACK();
  }

  if (verifiedAmount !== amountPaid) {
    logger.error('Webhook: amount mismatch between webhook payload and Monnify API', {
      transactionRef,
      webhookAmount: amountPaid,
      apiAmount: verifiedAmount,
    });
    return ACK();
  }

  logger.info('Webhook: transaction verified via Monnify API', {
    transactionRef,
    paymentStatus: verifiedStatus,
    amountPaid: verifiedAmount,
  });

  try {
    await db.$transaction(async (tx) => {
      await tx.webhookEvent.upsert({
        where:  { id: transactionRef },
        create: { id: transactionRef, processed: false, payload },
        update: { payload },
      });

      await advanceState(
        pendingOrder.id,
        'Paid',
        { ref: transactionRef, flagged, flagReason },
        tx
      );

      await advanceState(pendingOrder.id, 'Awaiting Shipment', {}, tx);

      await tx.webhookEvent.update({
        where: { id: transactionRef },
        data:  { processed: true },
      });
    });

    logger.info('Webhook: order advanced to Awaiting Shipment', {
      orderId:      pendingOrder.id,
      transactionRef,
      amountPaid,
      flagged,
    });
  } catch (err) {
    logger.error('Webhook: atomic transaction failed', {
      orderId:      pendingOrder.id,
      transactionRef,
      err,
    });
  }

  return ACK();
}
