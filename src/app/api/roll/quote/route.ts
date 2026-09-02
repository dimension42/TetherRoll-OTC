import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireVip, handleApiError } from '@/lib/auth/guards';
import { parseBody, rateLimit } from '@/lib/roll/http';
import { generateQuote } from '@/lib/roll/quote';
import { ROLL_CHAINS } from '@/lib/tokens';

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

    const quote = await generateQuote(user.id, {
      ...body,
      chain: body.chain as typeof ROLL_CHAINS[number]['key'],
    });

    return NextResponse.json(quote);
  } catch (e) {
    return handleApiError(e);
  }
}
