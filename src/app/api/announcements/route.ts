import { handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/announcements — 공개 API.
 * { announcement: { text, level } | null, tradingPaused: boolean }
 */
export async function GET() {
  try {
    const now = new Date().toISOString();

    // 활성 공지 (가장 최근 1개)
    const { data: announcements } = await db()
      .from('announcements')
      .select('text, level')
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(1);

    const announcement = announcements?.[0] ?? null;

    // 킬스위치
    const { data: killSwitch } = await db()
      .from('platform_settings')
      .select('value')
      .eq('key', 'kill_switch')
      .maybeSingle();

    const tradingPaused = killSwitch?.value?.enabled === true;

    return Response.json({ announcement, tradingPaused });
  } catch (e) {
    return handleApiError(e);
  }
}
