import pino from 'pino';

/**
 * Structured logging (Part 7.5) — JSON lines with request context for
 * rejected webhooks, scored transactions, and merchant decisions.
 */

export function createLogger(level = 'info') {
  return pino({
    level,
    base: { service: 'merchantshield-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = createLogger();
