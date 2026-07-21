import { verifyWebhookSignature, verifyTransaction } from '../../../../lib/monnifyClient.js';
import {
  advanceState,
  findPendingOrderBySeller,
  runFraudCheck,
} from '../../../../lib/orderService.js';
import { logger } from '../../../../lib/logger.js';
import db from '../../../../lib/db.js';

export const dynamic = 'force-dynamic';

const MONNIFY_IP = '35.242.133.146';
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

  // IP whitelist — defense-in-depth even with HMAC
  if (!isSandbox) {
    const callerIp =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (callerIp && callerIp !== MONNIFY_IP) {
      logger.warn('Webhook: request from unexpected IP — rejected', { callerIp });
      return ACK();
    }
  }

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

  // Atomic dedup: claim this event via WebhookEvent row BEFORE the ACK so
  // dedup survives a serverless function kill. If the row already exists:
  //   - processed: true   → ACK (already handled)
  //   - processed: false  → previous invocation crashed → delete + re-claim
  let claimed = false;
  try {
    await db.webhookEvent.create({
      data: { id: transactionRef, processed: false, payload: eventData },
    });
    claimed = true;
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await db.webhookEvent.findUnique({ where: { id: transactionRef } });
      if (existing && !existing.processed) {
        logger.warn('Webhook: previous invocation crashed — re-processing', { transactionRef });
        await db.webhookEvent.delete({ where: { id: transactionRef } }).catch(() => {});
      } else {
        logger.info('Webhook: duplicate event ignored (already processed)', { transactionRef });
        return ACK();
      }
    } else {
      throw err;
    }
  }

  if (!claimed) {
    try {
      await db.webhookEvent.create({
        data: { id: transactionRef, processed: false, payload: eventData },
      });
      claimed = true;
    } catch {
      logger.error('Webhook: failed to claim event after retry', { transactionRef });
      return ACK();
    }
  }

  // ACK now — the dedup row is committed. Heavy processing continues below.
  // In production serverless, offload to a queue (SQS, RabbitMQ) instead
  // of relying on the function's lifetime after response.
  const processing = handleNotification(transactionRef, eventData, isSandbox);
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Fire-and-forget: the runtime may terminate before this completes.
    // The dedup is already persisted so the event won't be double-processed,
    // but on failure the WebhookEvent row is deleted so Monnify's retry
    // can re-process.
    processing.catch((err) => {
      logger.error('Webhook: background processing failed', { transactionRef, err });
    });
  } else {
    await processing;
  }

  return ACK();
}

async function removeClaim(transactionRef) {
  await db.webhookEvent.delete({ where: { id: transactionRef } }).catch(() => {});
}

export async function handleNotification(transactionRef, eventData, isSandbox) {
  const accountReference = eventData?.product?.reference ?? '';
  const sellerIdMatch    = accountReference.match(/^PAYPROOF-USER-(\d+)/);

  if (!sellerIdMatch) {
    logger.error('Webhook: cannot parse sellerId from accountReference', {
      accountReference,
      transactionRef,
    });
    await removeClaim(transactionRef);
    return;
  }

  const sellerId = Number(sellerIdMatch[1]);
  const seller   = await db.user.findUnique({ where: { id: sellerId } });

  if (!seller) {
    logger.error('Webhook: seller not found', { sellerId, transactionRef });
    await removeClaim(transactionRef);
    return;
  }

  const amountPaid              = Math.round(Number(eventData.amountPaid ?? 0));
  const pendingOrder = await findPendingOrderBySeller(sellerId, amountPaid);

  if (!pendingOrder) {
    logger.warn('Webhook: no pending order found for seller', {
      sellerId,
      transactionRef,
    });
    // Permanent — no order will appear on retry. Stop claiming so retries
    // also stop.
    await db.webhookEvent.update({
      where: { id: transactionRef },
      data:  { processed: true },
    }).catch(() => {});
    return;
  }

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
    logger.error('Webhook: Monnify API verification failed — removing claim for retry', {
      transactionRef,
      err: verifyErr,
    });
    await removeClaim(transactionRef);
    return;
  }

  if (verifiedStatus !== 'PAID') {
    logger.error('Webhook: Monnify API reports payment not PAID', {
      transactionRef,
      paymentStatus: verifiedStatus,
    });
    // Permanent — won't change on retry. Stop claiming.
    await db.webhookEvent.update({
      where: { id: transactionRef },
      data:  { processed: true },
    }).catch(() => {});
    return;
  }

  if (verifiedAmount !== amountPaid) {
    logger.error('Webhook: amount mismatch between webhook payload and Monnify API', {
      transactionRef,
      webhookAmount: amountPaid,
      apiAmount: verifiedAmount,
    });
    // Permanent — won't change on retry. Stop claiming.
    await db.webhookEvent.update({
      where: { id: transactionRef },
      data:  { processed: true },
    }).catch(() => {});
    return;
  }

  logger.info('Webhook: transaction verified via Monnify API', {
    transactionRef,
    paymentStatus: verifiedStatus,
    amountPaid: verifiedAmount,
  });

  try {
    await db.$transaction(async (tx) => {
      await advanceState(
        pendingOrder.id,
        'Paid',
        { ref: transactionRef, flagged, flagReason },
        tx,
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
    logger.error('Webhook: atomic transaction failed — removing claim for retry', {
      orderId:      pendingOrder.id,
      transactionRef,
      err,
    });
    await removeClaim(transactionRef);
  }
}
