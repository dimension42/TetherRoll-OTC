import { requireUser, handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { destroySession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout-all — 모든 세션 무효화 (session_version 증가).
 */
export async function POST() {
  try {
    const user = await requireUser();

    // session_version 증가 (현재 값 조회 후 +1)
    const { data: currentUser } = await db().from('users').select('session_version').eq('id', user.id).single();
    const newVersion = (currentUser?.session_version ?? 1) + 1;
    await db()
      .from('users')
      .update({ session_version: newVersion })
      .eq('id', user.id);

    // 현재 세션 쿠키 삭제
    destroySession();

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
