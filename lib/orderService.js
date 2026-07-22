import { randomBytes } from 'crypto';
import db from './db.js';
import { logger } from './logger.js';

export const ORDER_STATES = [
  'PendingPayment',
  'Paid',
  'AwaitingShipment',
  'Shipped',
  'Delivered',
  'Completed',
];

const TRANSITIONS = {
  'PendingPayment':   ['Paid'],
  'Paid':              ['AwaitingShipment'],
  'AwaitingShipment': ['Shipped'],
  'Shipped':           ['Delivered'],
  'Delivered':         ['Completed'],
  'Completed':         [],
};

function generateOrderId() {
  return `PP-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function generateRef() {
  return `MNFY-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createOrder({ buyerName, sellerId, productSlug, phone, buyerId }, client = db) {
  const product = productSlug
    ? await client.product.findFirst({ where: { slug: productSlug, sellerId } })
    : await client.product.findFirst({ where: { sellerId } });

  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  const now = new Date().toISOString();

  const order = await client.order.create({
    data: {
      id:         generateOrderId(),
      ref:        generateRef(),
      buyer:      buyerName.trim(),
      phone:      phone?.trim() ?? null,
      buyerId:    buyerId ?? null,
      item:       product.name,
      amount:     product.price,
      state:      'PendingPayment',
      flagged:    false,
      timestamps: { 'PendingPayment': now },
      sellerId,
    },
  });

  logger.info('Order created', { orderId: order.id, sellerId, amount: order.amount });

  return formatOrder(order);
}

export async function getOrder(id, client = db) {
  const order = await client.order.findUnique({ where: { id } });
  return order ? formatOrder(order) : null;
}

export async function listOrders({ sellerId }, client = db) {
  const orders = await client.order.findMany({
    where:   { sellerId },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(formatOrder);
}

export async function advanceState(orderId, toState, options = {}, client = db) {
  const order = await client.order.findUnique({ where: { id: orderId } });

  if (!order) throw new Error('ORDER_NOT_FOUND');

  const allowedNext = TRANSITIONS[order.state] ?? [];
  if (!allowedNext.includes(toState)) {
    throw new Error(
      `INVALID_TRANSITION: Cannot move order "${orderId}" from ` +
      `"${order.state}" to "${toState}". Allowed: [${allowedNext.join(', ')}]`
    );
  }

  const now = new Date().toISOString();

  const updateData = {
    state:      toState,
    timestamps: { ...(order.timestamps ?? {}), [toState]: now },
  };

  if (options.ref        !== undefined) updateData.ref        = options.ref;
  if (options.flagged    !== undefined) updateData.flagged    = options.flagged;
  if (options.flagReason !== undefined) updateData.flagReason = options.flagReason;

  // Optimistic lock: only update if the state still matches what we read.
  // If another request already advanced this order, the update hits 0 rows
  // and we throw instead of silently overwriting.
  const result = await client.order.updateMany({
    where: { id: orderId, state: order.state },
    data:  updateData,
  });

  if (result.count === 0) {
    const current = await client.order.findUnique({ where: { id: orderId } });
    if (!current) throw new Error('ORDER_NOT_FOUND');
    throw new Error(
      `INVALID_TRANSITION: Cannot move order "${orderId}" from ` +
      `"${order.state}" to "${toState}" — current state is "${current.state}".`
    );
  }

  const updated = await client.order.findUnique({ where: { id: orderId } });

  logger.info('Order state advanced', {
    orderId,
    from:    order.state,
    to:      toState,
    flagged: updated.flagged,
  });

  return formatOrder(updated);
}

export async function findPendingOrderBySeller(sellerId, amount, client = db) {
  const order = await client.order.findFirst({
    where:   { sellerId, state: 'PendingPayment', amount },
    orderBy: { createdAt: 'desc' },
  });
  return order ?? null;
}

export function runFraudCheck(amountPaid, typicalOrder) {
  if (!typicalOrder || typicalOrder <= 0) return { flagged: false };

  const THRESHOLD = Number(process.env.FRAUD_THRESHOLD) || 5;
  const ratio     = amountPaid / typicalOrder;

  if (ratio > THRESHOLD) {
    const multiple        = Math.round(ratio);
    const amountFormatted = `₦${amountPaid.toLocaleString('en-NG')}`;
    const typicalFormatted= `₦${typicalOrder.toLocaleString('en-NG')}`;

    return {
      flagged:    true,
      flagReason: `${amountFormatted} is about ${multiple}× this seller's typical order of ${typicalFormatted}.`,
    };
  }

  return { flagged: false };
}

function formatOrder(order) {
  return {
    id:         order.id,
    ref:        order.ref,
    buyer:      order.buyer,
    phone:      order.phone ?? undefined,
    item:       order.item,
    amount:     order.amount,
    state:      order.state,
    flagged:    order.flagged,
    flagReason: order.flagReason ?? undefined,
    timestamps: order.timestamps,
  };
}
