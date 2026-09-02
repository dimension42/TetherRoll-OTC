import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import { requireVip, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';
import { ROLL_CHAINS } from '@/lib/tokens';
import { notifyNewOrder, notifyLargeOrder } from '@/lib/roll/notify';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  quoteId: z.string().uuid(),
  receiveAddress: z.string(),
  minFillPct: z.number().int().min(0).max(100),
  expiresIn: z.enum(['1h', '6h', '24h']),
});

function generateDepositCode(): string {
  // TR-XXXXXX uppercase base32 (no 0/O/1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TR-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function validateAddress(chain: string, address: string): boolean {
  const chainInfo = ROLL_CHAINS.find(c => c.key === chain);
  if (!chainInfo) return false;

  if (chainInfo.evm) {
    return isAddress(address);
  } else if (chain === 'TRC20') {
    // TRC20: base58 starting with T, 34 chars
    return /^T[A-Za-z0-9]{33}$/.test(address);
  }
  return false;
}

export async function GET() {
  try {
    const user = await requireVip();
    const { data } = await db()
      .from('roll_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ orders: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireVip();
    const body = await parseBody(req, createSchema);

    // 1. Check kill switch
    const { data: settings } = await db().from('platform_settings').select('*').eq('key', 'kill_switch').maybeSingle();
    const killSwitch = settings?.value as { enabled?: boolean } | null;
    if (killSwitch?.enabled) {
      return NextResponse.json({ error: 'Trading paused' }, { status: 503 });
    }

    // 2. Fetch quote
    const { data: quote } = await db()
      .from('roll_quotes')
      .select('*')
      .eq('id', body.quoteId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!quote) throw new AuthError(400, 'Quote not found or expired');

    const expiresAt = new Date(quote.expires_at);
    if (expiresAt < new Date()) throw new AuthError(400, 'Quote expired');

    // 3. Fetch min fill floor & max amount
    const { data: feeConfigs } = await db().from('fee_configs').select('*').in('key', ['roll_min_fill_pct_floor', 'roll_max_amount_krw']).order('created_at', { ascending: false });
    const minFillFloor = parseFloat(feeConfigs?.find(f => f.key === 'roll_min_fill_pct_floor')?.value ?? '0');
    const maxAmountKrw = parseFloat(feeConfigs?.find(f => f.key === 'roll_max_amount_krw')?.value ?? '1000000000');

    if (body.minFillPct < minFillFloor) {
      throw new AuthError(400, `Min fill % must be at least ${minFillFloor}`);
    }
    if (parseFloat(quote.amount_krw) > maxAmountKrw) {
      throw new AuthError(400, `Amount exceeds max (₩${maxAmountKrw.toLocaleString()})`);
    }

    // 4. Validate receive address
    if (!validateAddress(quote.chain, body.receiveAddress)) {
      throw new AuthError(400, 'Invalid receive address for selected chain');
    }

    // 5. Generate unique deposit code
    let depositCode = generateDepositCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await db()
        .from('roll_orders')
        .select('id')
        .eq('deposit_code', depositCode)
        .maybeSingle();
      if (!existing) break;
      depositCode = generateDepositCode();
      attempts++;
    }
    if (attempts >= 10) throw new Error('Failed to generate unique deposit code');

    // 6. Compute expiry
    const expiryMap = { '1h': 3600, '6h': 21600, '24h': 86400 };
    const orderExpiresAt = new Date(Date.now() + expiryMap[body.expiresIn] * 1000);

    // 7. Create order
    const { data: order } = await db()
      .from('roll_orders')
      .insert({
        user_id: user.id,
        side: quote.side,
        asset: quote.asset,
        chain: quote.chain,
        receive_address: body.receiveAddress,
        amount_krw: quote.amount_krw,
        min_fill_pct: body.minFillPct,
        slippage_bps: quote.slippage_bps,
        expires_at: orderExpiresAt.toISOString(),
        quote_snapshot: quote.venues,
        est_fee_platform: quote.est_fee_platform,
        est_fee_gas: quote.est_fee_gas,
        status: 'AWAITING_DEPOSIT',
        deposit_code: depositCode,
        quote_id: quote.id,
      })
      .select('id')
      .single();

    if (!order) throw new Error('Failed to create order');

    // 8. Check if bank info is configured
    const bankName = process.env.ROLL_BANK_NAME;
    const bankAccount = process.env.ROLL_BANK_ACCOUNT;
    const bankHolder = process.env.ROLL_BANK_HOLDER;
    const configured = !!(bankName && bankAccount && bankHolder);

    // 9. Notify
    await notifyNewOrder(order.id, parseFloat(quote.total_krw), depositCode);
    await notifyLargeOrder(order.id, parseFloat(quote.total_krw));

    return NextResponse.json({
      id: order.id,
      status: 'AWAITING_DEPOSIT',
      deposit: {
        configured,
        bank: bankName ?? null,
        account: bankAccount ?? null,
        holder: bankHolder ?? null,
        amountKrw: parseFloat(quote.total_krw),
        code: depositCode,
      },
      expiresAt: orderExpiresAt.toISOString(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
