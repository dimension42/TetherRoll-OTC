import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth/guards';

/**
 * DB 기반 fixed window rate limiting (외부 의존 없음).
 * rate_limits 테이블: (key text primary, window_start timestamptz, count int)
 */

export async function enforceRateLimit(scope: string, id: string, limit: number, windowSec: number): Promise<void> {
  const key = `${scope}:${id}`;
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSec * 1000)) * (windowSec * 1000));

  const { data } = await db()
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle();

  if (!data) {
    // 첫 요청 — 행 생성
    await db().from('rate_limits').insert({ key, window_start: windowStart.toISOString(), count: 1 });
    return;
  }

  const existingStart = new Date(data.window_start);
  if (existingStart.getTime() === windowStart.getTime()) {
    // 같은 윈도우 — count 증가
    if (data.count >= limit) {
      throw new AuthError(429, 'Too many requests');
    }
    await db().from('rate_limits').update({ count: data.count + 1 }).eq('key', key);
  } else {
    // 새 윈도우 — 카운트 리셋
    await db().from('rate_limits').update({ window_start: windowStart.toISOString(), count: 1 }).eq('key', key);
  }
}

/** 편의 래퍼: IP 기반 레이트리밋 (헤더에서 IP 추출) */
export async function rateLimitByIp(req: Request, limit: number, windowSec: number): Promise<void> {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  await enforceRateLimit('ip', ip, limit, windowSec);
}

/** 편의 래퍼: 유저 ID 기반 */
export async function rateLimitByUser(userId: string, scope: string, limit: number, windowSec: number): Promise<void> {
  await enforceRateLimit(`user:${scope}`, userId, limit, windowSec);
}
