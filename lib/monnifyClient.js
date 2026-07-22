import crypto from 'crypto';
import { logger } from './logger.js';

const BASE_URL = process.env.MONNIFY_BASE_URL ?? 'https://sandbox.monnify.com';

let _tokenCache = null;
let _tokenPromise = null;

export async function getToken() {
  const now = Date.now();

  if (_tokenCache && now < _tokenCache.expiresAt) {
    logger.debug('Monnify token served from cache');
    return _tokenCache.token;
  }

  // Singleflight: if a refresh is already in-flight, wait for it instead
  // of starting N simultaneous auth requests (prevents thundering herd on
  // expiry and reduces cold-start penalty to one fetch per instance).
  if (_tokenPromise) {
    return _tokenPromise;
  }

  _tokenPromise = (async () => {
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

    _tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };

    logger.info('Monnify access token refreshed', {
      expiresAt: new Date(_tokenCache.expiresAt).toISOString(),
    });

    return token;
  })();

  try {
    return await _tokenPromise;
  } finally {
    _tokenPromise = null;
  }
}

export async function createReservedAccount({ userId, name, contact, bvn }) {
  const contractCode = process.env.MONNIFY_CONTRACT_CODE;
  if (!contractCode) {
    throw new Error('[PayProof] MONNIFY_CONTRACT_CODE is not set.');
  }
  if (!bvn) {
    throw new Error('[PayProof] BVN is required to create a Monnify reserved account.');
  }

  const token = await getToken();

  const body = {
    accountReference: `PAYPROOF-USER-${userId}-${Date.now().toString(36)}`,
    accountName: `PayProof — ${name}`,
    currencyCode: 'NGN',
    contractCode,
    customerEmail: contact,
    customerName: name,
    getAllAvailableBanks: true,
    bvn,
  };

  console.log('=== createReservedAccount REQUEST BODY ===', JSON.stringify(body, null, 2));

  let response;
  try {
    response = await fetch(
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
  } catch (fetchErr) {
    console.log('=== createReservedAccount FETCH ERROR (full) ===', fetchErr);
    throw fetchErr;
  }

  const rawBody = await response.text();

  console.log('=== createReservedAccount RAW RESPONSE ===', {
    status: response.status,
    statusText: response.statusText,
    body: rawBody,
    headers: Object.fromEntries(response.headers.entries()),
  });

  if (!response.ok) {
    const err = new Error(
      `[Monnify] createReservedAccount failed: ${response.status} ${rawBody}`
    );
    console.log('=== createReservedAccount THROWING ===', err);
    throw err;
  }

  const data  = JSON.parse(rawBody);
  const acct  = data.responseBody;
  const first = acct.accounts?.[0] ?? acct;

  logger.info('Monnify reserved account created', {
    userId,
    bank: first.bankName,
    number: first.accountNumber,
    name: acct.accountName,
  });

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
  if (isSandbox()) {
    logger.debug('validateBankAccount: sandbox — returning simulated result', { bankCode, accountNumber });
    return {
      bankCode,
      accountNumber,
      accountName: 'Sandbox Account',
    };
  }

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

export function isSandbox() {
  return (process.env.MONNIFY_BASE_URL ?? '').includes('sandbox');
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
