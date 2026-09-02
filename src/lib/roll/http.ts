import { z } from 'zod';

/**
 * Private copy of validation & rate-limit helpers for Roll Order routes.
 * Do not edit src/lib/validate.ts or src/lib/ratelimit.ts.
 */

export function parseBody<T>(req: Request, schema: z.ZodSchema<T>): Promise<T> {
  return req.json().then(body => schema.parse(body));
}

/**
 * Simple in-memory rate limiter (quotes only).
 * Key format: `quote:${userId}`.
 */
const limits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(key: string, maxCount: number, windowSec: number): boolean {
  const now = Date.now();
  const entry = limits.get(key);
  if (!entry || now - entry.windowStart > windowSec * 1000) {
    limits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxCount) return false;
  entry.count++;
  return true;
}
