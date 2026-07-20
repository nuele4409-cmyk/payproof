// Populate a fresh database with the demo personas the app was designed
// around — Ada (seller, has a reserved account + settlement + a product) and
// Tobi (buyer). Idempotent: safe to run against an already-seeded DB.
//
// Run:  node prisma/seed.js
//   or  npm run db:seed
//
// The demo passwords below are intentionally weak and public — this seed
// exists so a judge can click "Continue as Ada"/"Continue as Tobi" on the
// login page and be handed a real session token. Do not enable it in
// environments where these accounts are load-bearing.

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db   = new PrismaClient({ adapter: new PrismaPg(pool) });

export const DEMO_SELLER = {
  contact:  'ada@payproof.demo',
  password: 'payproof-demo',
  name:     'Ada Okafor',
};

export const DEMO_BUYER = {
  contact:  'tobi@payproof.demo',
  password: 'payproof-demo',
  name:     'Tobi Adeyemi',
};

async function main() {
  const sellerHash = await bcrypt.hash(DEMO_SELLER.password, 12);
  const buyerHash  = await bcrypt.hash(DEMO_BUYER.password,  12);

  const seller = await db.user.upsert({
    where:  { contact: DEMO_SELLER.contact },
    update: {},
    create: {
      contact:      DEMO_SELLER.contact,
      name:         DEMO_SELLER.name,
      passwordHash: sellerHash,
      role:         'seller',
      store:        'Ada’s Store',
      verified:     true,
      // Placeholder reserved account so the seal-reveal screen has something
      // to stamp when Monnify isn't reachable in local demos. Real signups
      // overwrite these three fields via createReservedAccount().
      reservedBank:     'Wema Bank',
      reservedNumber:   '9928447103',
      reservedName:     'PayProof — Ada Okafor',
      settlementBank:   '058',
      settlementNumber: '0123456789',
      settlementName:   'Ada Okafor',
      typicalOrder:     48500,
    },
  });

  await db.user.upsert({
    where:  { contact: DEMO_BUYER.contact },
    update: {},
    create: {
      contact:      DEMO_BUYER.contact,
      name:         DEMO_BUYER.name,
      passwordHash: buyerHash,
      role:         'buyer',
    },
  });

  await db.product.upsert({
    where:  { slug: 'aj1-low' },
    update: {},
    create: {
      slug:        'aj1-low',
      name:        'Air Jordan 1 Low (Panda)',
      price:       48500,
      description:
        'Brand new in box, UK 9. Lagos delivery within 48 hours, nationwide 3–5 days. ' +
        'Your payment is held by PayProof until you confirm delivery.',
      sellerId:    seller.id,
    },
  });

  console.log('Seeded demo data: Ada (seller), Tobi (buyer), AJ1 Low listing.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect().then(() => pool.end()));
