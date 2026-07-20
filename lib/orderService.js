import { randomInt } from 'crypto';
import db from './db.js';
import { logger } from './logger.js';

export const ORDER_STATES = [
  'Pending Payment',
  'Paid',
  'Awaiting Shipment',
  'Shipped',
  'Delivered',
  'Completed',
];

const TRANSITIONS = {
  'Pending Payment':   ['Paid'],
  'Paid':              ['Awaiting Shipment'],
  'Awaiting Shipment': ['Shipped'],
  'Shipped':           ['Delivered'],
  'Delivered':         ['Completed'],
  'Completed':         [],
};

function generateOrderId() {
  return `PP-${randomInt(1000, 9999)}-${randomInt(10, 99)}`;
}

function generateRef() {
  return `MNFY-${randomInt(10_000_000, 99_999_999)}`;
}

export async function createOrder({ buyerName, sellerId, productSlug }, client = db) {
  const product = await client.product.findFirst({
    where: { sellerId },
    ...(productSlug ? { where: { slug: productSlug, sellerId } } : {}),
  });

  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  const now = new Date().toISOString();

  const order = await client.order.create({
    data: {
      id:         generateOrderId(),
      ref:        generateRef(),
      buyer:      buyerName.trim(),
      item:       product.name,
      amount:     product.price,
      state:      'Pending Payment',
      flagged:    false,
      timestamps: { 'Pending Payment': now },
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

  const updated = await client.order.update({
    where: { id: orderId },
    data:  updateData,
  });

  logger.info('Order state advanced', {
    orderId,
    from:    order.state,
    to:      toState,
    flagged: updated.flagged,
  });

  return formatOrder(updated);
}

export async function findPendingOrderBySeller(sellerId, client = db) {
  return client.order.findFirst({
    where:   { sellerId, state: 'Pending Payment' },
    orderBy: { createdAt: 'desc' },
  });
}

export function runFraudCheck(amountPaid, typicalOrder) {
  if (!typicalOrder || typicalOrder <= 0) return { flagged: false };

  const THRESHOLD = 5;
  const ratio     = amountPaid / typicalOrder;

  if (ratio > THRESHOLD) {
    const multiple        = Math.round(ratio);
    const amountFormatted = `₦${amountPaid.toLocaleString('en-NG')}`;
    const typicalFormatted= `₦${typicalOrder.toLocaleString('en-NG')}`;

    return {
      flagged:    true,
      flagReason: `${amountFormatted} is about ${multiple}× Ada's typical order of ${typicalFormatted}.`,
    };
  }

  return { flagged: false };
}

function formatOrder(order) {
  return {
    id:         order.id,
    ref:        order.ref,
    buyer:      order.buyer,
    item:       order.item,
    amount:     order.amount,
    state:      order.state,
    flagged:    order.flagged,
    flagReason: order.flagReason ?? undefined,
    timestamps: order.timestamps,
  };
}
