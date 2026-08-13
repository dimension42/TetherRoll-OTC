import { destroySession } from '@/lib/auth/session';

export async function POST() {
  destroySession();
  return Response.json({ ok: true });
}
