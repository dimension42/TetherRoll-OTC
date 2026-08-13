import { cookies } from 'next/headers';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import { createSession } from '@/lib/auth/session';
import { upsertUserByWallet, assertNotBanned } from '@/lib/auth/link';
import { handleApiError } from '@/lib/auth/guards';

/** POST /api/auth/siwe/verify — { message, signature } */
export async function POST(req: Request) {
  try {
    const { message, signature } = await req.json();
    if (!message || !signature) return Response.json({ error: 'Missing fields' }, { status: 400 });

    const savedNonce = cookies().get('tr_siwe_nonce')?.value;
    const parsed = parseSiweMessage(message);
    if (!savedNonce || parsed.nonce !== savedNonce) {
      return Response.json({ error: 'Invalid nonce' }, { status: 401 });
    }

    const client = createPublicClient({ chain: mainnet, transport: http() });
    const valid = await verifySiweMessage(client, { message, signature });
    if (!valid || !parsed.address) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    cookies().set('tr_siwe_nonce', '', { httpOnly: true, path: '/', maxAge: 0 });

    const userId = await upsertUserByWallet(parsed.address);
    await assertNotBanned(userId);
    await createSession(userId);
    return Response.json({ ok: true, address: parsed.address });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403) return Response.json({ error: (e as Error).message }, { status: 403 });
    return handleApiError(e);
  }
}
