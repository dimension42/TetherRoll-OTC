import { z } from 'zod';
import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import { publicClientFor } from '@/lib/onchain/client';

/**
 * GET /api/wallets — 내 지갑 목록
 */
export async function GET() {
  try {
    const user = await requireUser();
    const { data } = await db()
      .from('user_wallets')
      .select('id, address, label, source, verified_at, is_primary, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return Response.json({ wallets: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/wallets/link — 로그인 상태에서 추가 지갑 연결 (SIWE)
 * body: { message, signature }
 */
const linkSchema = z.object({
  message: z.string(),
  signature: z.string(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { message, signature } = await parseBody(req, linkSchema);

    const parsed = parseSiweMessage(message);
    if (!parsed.address) throw new AuthError(400, 'Invalid SIWE message');

    // chainId로 public client 생성 + SIWE 검증
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = publicClientFor(parsed.chainId ?? 1);
    const addressLower = parsed.address.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await verifySiweMessage(client as any, { message, signature: signature as `0x${string}` });
    if (!valid) throw new AuthError(401, 'Invalid signature');

    // 이미 다른 유저에게 연결된 지갑인지 확인
    const { data: existing } = await db()
      .from('user_wallets')
      .select('user_id')
      .eq('address', addressLower)
      .maybeSingle();

    if (existing && existing.user_id !== user.id) {
      throw new AuthError(409, 'Wallet already linked to another account');
    }

    // 이미 내 지갑 목록에 있으면 무시
    if (existing && existing.user_id === user.id) {
      return Response.json({ ok: true, message: 'Wallet already linked' });
    }

    // 신규 등록
    await db().from('user_wallets').insert({
      user_id: user.id,
      address: addressLower,
      source: 'siwe',
      verified_at: new Date().toISOString(),
      is_primary: false,
    });

    return Response.json({ ok: true, address: addressLower });
  } catch (e) {
    return handleApiError(e);
  }
}
