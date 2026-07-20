import crypto from 'crypto';
import { logger } from './logger.js';

const BASE_URL = process.env.MONNIFY_BASE_URL ?? 'https://sandbox.monnify.com';

let _tokenCache = null;

export async function getToken() {
  const now = Date.now();

  if (_tokenCache && now < _tokenCache.expiresAt) {
    logger.debug('Monnify token served from cache');
    return _tokenCache.token;
  }

  const apiKey    = process.env.MONNIFY_API_KEY;
  const secretKey = process.env.MONNIFY_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error(
      '[PayProof] MONNIFY_API_KEY or MONNIFY_SECRET_KEY is not set.'
    );
  }

  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

  logger.debug('Fetching fresh Monnify access token');

  const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[Monnify] getToken failed: ${response.status} ${body}`);
  }

  const data  = await response.json();
  const token = data.responseBody.accessToken;

  _tokenCache = { token, expiresAt: now + 55 * 60 * 1000 };

  logger.info('Monnify access token refreshed', {
    expiresAt: new Date(_tokenCache.expiresAt).toISOString(),
  });

  return token;
}

const TEST_BVN = '21212121212';

export async function createReservedAccount({ userId, name, contact, bvn }) {
  const contractCode = process.env.MONNIFY_CONTRACT_CODE;
  if (!contractCode) {
    throw new Error('[PayProof] MONNIFY_CONTRACT_CODE is not set.');
  }

  const token = await getToken();

  const body = {
    accountReference: `PAYPROOF-USER-${userId}`,
    accountName: `PayProof — ${name}`,
    currencyCode: 'NGN',
    contractCode,
    customerEmail: contact,
    customerName: name,
    getAllAvailableBanks: true,
  };

  if (bvn) {
    body.bvn = bvn;
  } else if (BASE_URL.includes('sandbox')) {
    body.bvn = TEST_BVN;
  } else {
    throw new Error('[PayProof] BVN or NIN is required to create a reserved account in production.');
  }

  const response = await fetch(
    `${BASE_URL}/api/v2/bank-transfer/reserved-accounts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[Monnify] createReservedAccount failed: ${response.status} ${body}`
    );
  }

  const data  = await response.json();
  const acct  = data.responseBody;
  const first = acct.accounts?.[0] ?? acct;

  logger.info('Monnify reserved account created', { userId, bank: first.bankName });

  return {
    bank:   first.bankName,
    number: first.accountNumber,
    name:   acct.accountName,
  };
}

export async function verifyTransaction(transactionReference) {
  const token = await getToken();

  const url = new URL(`${BASE_URL}/api/v2/merchant/transactions/query`);
  url.searchParams.set('transactionReference', transactionReference);

  logger.debug('Verifying transaction with Monnify API', { transactionReference });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[Monnify] verifyTransaction failed: ${response.status} ${body}`
    );
  }

  const data = await response.json();
  const result = data.responseBody;

  logger.info('Monnify transaction verification result', {
    transactionReference,
    paymentStatus: result.paymentStatus,
    amountPaid: result.amountPaid,
  });

  return {
    paymentStatus: result.paymentStatus,
    amountPaid: Math.round(Number(result.amountPaid ?? 0)),
  };
}

export async function validateBankAccount(bankCode, accountNumber) {
  const token = await getToken();

  const url = new URL(`${BASE_URL}/api/v2/disbursements/account/validate`);
  url.searchParams.set('accountNumber', accountNumber);
  url.searchParams.set('bankCode', bankCode);

  logger.debug('Validating bank account', { bankCode, accountNumber });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[Monnify] validateBankAccount failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const result = data.responseBody;

  logger.info('Bank account validated', {
    accountNumber: result.accountNumber,
    accountName: result.accountName,
    bankCode: result.bankCode,
  });

  return {
    accountNumber: result.accountNumber,
    accountName: result.accountName,
    bankCode: result.bankCode,
  };
}

export async function singleTransfer({ amount, reference, narration, destinationBankCode, destinationAccountNumber, destinationAccountName, sourceAccountNumber }) {
  const token = await getToken();

  const body = {
    amount,
    reference,
    narration,
    destinationBankCode,
    destinationAccountNumber,
    destinationAccountName,
    currency: 'NGN',
    sourceAccountNumber,
  };

  logger.debug('Initiating single transfer', { reference, amount, destinationBankCode, destinationAccountNumber });

  const response = await fetch(`${BASE_URL}/api/v2/disbursements/single`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[Monnify] singleTransfer failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const result = data.responseBody;

  logger.info('Single transfer initiated', {
    reference,
    amount,
    status: result.status,
    destinationAccountNumber,
  });

  return {
    status: result.status,
    reference: result.reference,
    amount: result.amount,
  };
}

export function verifyWebhookSignature(rawBody, signature) {
  const secretKey = process.env.MONNIFY_SECRET_KEY;
  if (!secretKey) {
    throw new Error('[PayProof] MONNIFY_SECRET_KEY is not set.');
  }

  const expected = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected,  'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}
