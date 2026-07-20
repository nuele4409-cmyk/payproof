import db from '../../../lib/db.js';
import { logger } from '../../../lib/logger.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  try {
    await db.$queryRaw`SELECT 1`;

    const latencyMs = Date.now() - start;

    logger.debug('Health check passed', { latencyMs });

    return Response.json(
      {
        status:    'ok',
        db:        'connected',
        latencyMs,
        ts:        new Date().toISOString(),
        version:   process.env.npm_package_version ?? 'unknown',
      },
      { status: 200 }
    );
  } catch (err) {
    const latencyMs = Date.now() - start;

    logger.error('Health check failed — DB unreachable', { err, latencyMs });

    return Response.json(
      {
        status:    'degraded',
        db:        'unreachable',
        latencyMs,
        ts:        new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
