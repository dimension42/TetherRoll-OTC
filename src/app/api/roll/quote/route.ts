import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireVip, handleApiError } from '@/lib/auth/guards';
import { parseBody, rateLimit } from '@/lib/roll/http';
import { generateQuote } from '@/lib/roll/quote';
import { ROLL_CHAINS } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

const schema = z.object({
  side: z.enum(['BUY', 'SELL']),
  asset: z.enum(['USDT', 'USDC']),
  chain: z.enum(ROLL_CHAINS.map(c => c.key) as [string, ...string[]]),
  amountKrw: z.number().positive().max(1_000_000_000),
  slippageBps: z.number().int().min(0).max(500).default(50),
});

export async function POST(req: Request) {
  try {
    const user = await requireVip();

    // Rate limit: 60/min/user
    if (!rateLimit(`quote:${user.id}`, 60, 60)) {
      return NextResponse.json({ error: 'Too many quote requests' }, { status: 429 });
    }

    const body = await parseBody(req, schema);

    // 런칭 범위: KRW 입금 → 자산 지급(BUY)만. SELL(자산 입금 → KRW 지급)은 크립토 수취 경로가 없어 미지원.
    if (body.side === 'SELL') {
      return NextResponse.json({ error: 'Sell side is not available yet' }, { status: 501 });
    }

    const quote = await generateQuote(user.id, {
      ...body,
      chain: body.chain as typeof ROLL_CHAINS[number]['key'],
    });

    return NextResponse.json(quote);
  } catch (e) {
    return handleApiError(e);
  }
}
