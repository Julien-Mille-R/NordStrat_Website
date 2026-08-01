import crypto from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';

function hashedKey(prefix, key) {
  return crypto
    .createHmac('sha256', process.env.RATE_LIMIT_SECRET || process.env.SESSION_SECRET)
    .update(`${prefix}\0${key}`)
    .digest('hex');
}

export class PostgresRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60_000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const [counter] = await sequelize.query(
      `INSERT INTO rate_limit_counter (key_hash, hits, reset_at)
       VALUES (:keyHash, 1, CURRENT_TIMESTAMP + (:windowMs * INTERVAL '1 millisecond'))
       ON CONFLICT (key_hash) DO UPDATE
       SET hits = CASE
             WHEN rate_limit_counter.reset_at <= CURRENT_TIMESTAMP THEN 1
             ELSE rate_limit_counter.hits + 1
           END,
           reset_at = CASE
             WHEN rate_limit_counter.reset_at <= CURRENT_TIMESTAMP
               THEN CURRENT_TIMESTAMP + (:windowMs * INTERVAL '1 millisecond')
             ELSE rate_limit_counter.reset_at
           END
       RETURNING hits, reset_at AS "resetTime"`,
      {
        replacements: {
          keyHash: hashedKey(this.prefix, key),
          windowMs: this.windowMs,
        },
        type: QueryTypes.SELECT,
      },
    );

    return {
      totalHits: Number(counter.hits),
      resetTime: new Date(counter.resetTime),
    };
  }

  async decrement(key) {
    await sequelize.query(
      `UPDATE rate_limit_counter
       SET hits = GREATEST(hits - 1, 0)
       WHERE key_hash = :keyHash`,
      {
        replacements: { keyHash: hashedKey(this.prefix, key) },
        type: QueryTypes.UPDATE,
      },
    );
  }

  async resetKey(key) {
    await sequelize.query(
      'DELETE FROM rate_limit_counter WHERE key_hash = :keyHash',
      {
        replacements: { keyHash: hashedKey(this.prefix, key) },
        type: QueryTypes.DELETE,
      },
    );
  }
}

export async function cleanupExpiredRateLimits() {
  await sequelize.query(
    'DELETE FROM rate_limit_counter WHERE reset_at <= CURRENT_TIMESTAMP',
    { type: QueryTypes.DELETE },
  );
}
