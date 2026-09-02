import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/custody/assets — list all assets (viewer)
 */
export async function GET() {
  try {
    await requireRole('viewer');

    const { data: assets, error } = await db()
      .from('custody_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ assets: assets || [] });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/admin/custody/assets — create new asset (admin)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole('admin');

    const schema = z.object({
      chainKey: z.string().regex(/^[A-Z0-9_]{2,16}$/, 'chainKey must be 2-16 uppercase alphanumeric/underscore'),
      chainName: z.string().min(1),
      symbol: z.string().regex(/^[A-Z0-9.]{1,12}$/, 'symbol must be 1-12 uppercase alphanumeric/dot'),
      name: z.string().min(1),
      decimals: z.number().int().min(0).max(18),
      kind: z.enum(['native', 'token']),
      tokenId: z.string().optional(),
      depositAddress: z.string().min(1),
      addressRegex: z.string().optional(),
      explorerTxUrl: z.string().optional(),
      explorerAddressUrl: z.string().optional(),
      verifier: z.enum(['bitcoin', 'tron', 'solana', 'evm', 'manual']),
      verifierConfig: z.record(z.unknown()).default({}),
      minConfirmations: z.number().int().min(0).max(100),
      minAmount: z.string().regex(/^\d+$/, 'minAmount must be numeric string'),
      maxAmount: z.string().regex(/^\d+$/, 'maxAmount must be numeric string').optional(),
      payout2pThreshold: z.string().regex(/^\d+$/, 'payout2pThreshold must be numeric string').optional(),
      enabled: z.boolean().default(false),
    });

    const body = await parseBody(req, schema);

    // Validate address_regex compiles
    if (body.addressRegex) {
      try {
        new RegExp(body.addressRegex);
      } catch {
        return Response.json({ error: 'Invalid addressRegex pattern' }, { status: 400 });
      }
    }

    // Validate explorer URLs contain {hash} placeholder if provided
    if (body.explorerTxUrl && !body.explorerTxUrl.includes('{hash}')) {
      return Response.json({ error: 'explorerTxUrl must contain {hash} placeholder' }, { status: 400 });
    }

    // Insert asset
    const { data: asset, error } = await db()
      .from('custody_assets')
      .insert({
        chain_key: body.chainKey,
        chain_name: body.chainName,
        symbol: body.symbol,
        name: body.name,
        decimals: body.decimals,
        kind: body.kind,
        token_id: body.tokenId || null,
        deposit_address: body.depositAddress,
        address_regex: body.addressRegex || null,
        explorer_tx_url: body.explorerTxUrl || null,
        explorer_address_url: body.explorerAddressUrl || null,
        verifier: body.verifier,
        verifier_config: body.verifierConfig,
        min_confirmations: body.minConfirmations,
        min_amount: body.minAmount,
        max_amount: body.maxAmount || null,
        payout_2p_threshold: body.payout2pThreshold || null,
        enabled: body.enabled,
        created_by: admin.id,
      })
      .select()
      .single();

    if (error) throw error;

    await auditLog(admin.id, 'custody_asset.create', { type: 'custody_asset', id: asset.id }, null, asset);

    return Response.json({ asset });
  } catch (e) {
    return handleApiError(e);
  }
}
