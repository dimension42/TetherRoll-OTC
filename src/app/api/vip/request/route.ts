import { db } from '@/lib/db';
import { requireUser, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const COOLDOWN_DAYS = 7;

/** POST /api/vip/request — { reason, expectedVolume?, contact? } */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.vip_status === 'approved') return Response.json({ error: 'Already approved' }, { status: 400 });

    const { reason, expectedVolume, contact } = await req.json();
    if (!reason?.trim()) return Response.json({ error: 'Reason required' }, { status: 400 });

    const client = db();

    // pending 중복 방지 + 거절 후 쿨다운
    const { data: recent } = await client
      .from('vip_access_requests')
      .select('status, reviewed_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.status === 'pending') {
      return Response.json({ error: 'Request already pending' }, { status: 409 });
    }
    if (recent?.status === 'rejected' && recent.reviewed_at) {
      const elapsed = Date.now() - new Date(recent.reviewed_at).getTime();
      if (elapsed < COOLDOWN_DAYS * 86400_000) {
        return Response.json({ error: `Rejected recently — retry after ${COOLDOWN_DAYS} days` }, { status: 429 });
      }
    }

    await client.from('vip_access_requests').insert({
      user_id: user.id,
      reason: reason.trim().slice(0, 2000),
      expected_volume: expectedVolume?.toString().slice(0, 200) ?? null,
      contact: contact?.toString().slice(0, 200) ?? null,
    });
    await client.from('users').update({ vip_status: 'pending', updated_at: new Date().toISOString() }).eq('id', user.id);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** GET /api/vip/request — 내 최근 요청 상태 */
export async function GET() {
  try {
    const user = await requireUser();
    const { data } = await db()
      .from('vip_access_requests')
      .select('status, reject_reason, created_at, reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return Response.json({ vipStatus: user.vip_status, lastRequest: data ?? null });
  } catch (e) {
    return handleApiError(e);
  }
}
