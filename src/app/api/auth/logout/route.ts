import { destroySession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  destroySession();
  return Response.json({ ok: true });
}
