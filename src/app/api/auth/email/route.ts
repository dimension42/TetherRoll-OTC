import { authClient } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { upsertUserByEmail, assertNotBanned } from '@/lib/auth/link';
import { handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** POST /api/auth/email — { mode: 'login' | 'signup', email, password } */
export async function POST(req: Request) {
  try {
    const { mode, email, password } = await req.json();
    if (!email || !password || password.length < 8) {
      return Response.json({ error: 'Invalid email or password (min 8 chars)' }, { status: 400 });
    }

    const supa = authClient();

    if (mode === 'signup') {
      const { data, error } = await supa.auth.signUp({ email, password });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      if (!data.session) {
        // 이메일 확인이 켜져 있는 경우
        return Response.json({ ok: true, needsConfirmation: true });
      }
      const userId = await upsertUserByEmail(data.user!.id, email);
      await createSession(userId);
      return Response.json({ ok: true });
    }

    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error || !data.user) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const userId = await upsertUserByEmail(data.user.id, email);
    await assertNotBanned(userId);
    await createSession(userId);
    return Response.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403) return Response.json({ error: (e as Error).message }, { status: 403 });
    return handleApiError(e);
  }
}
