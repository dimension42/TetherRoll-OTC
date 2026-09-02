import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/custody/assets/[id] — update asset (admin)
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('admin');
    const { id } = params;

    const schema = z.object({
      chainKey: z.string().regex(/^[A-Z0-9_]{2,16}$/).optional(),
      chainName: z.string().min(1).optional(),
      symbol: z.string().regex(/^[A-Z0-9.]{1,12}$/).optional(),
      name: z.string().min(1).optional(),
      decimals: z.number().int().min(0).max(18).optional(),
      kind: z.enum(['native', 'token']).optional(),
      tokenId: z.string().optional(),
      depositAddress: z.string().min(1).optional(),
      addressRegex: z.string().optional(),
      explorerTxUrl: z.string().optional(),
      explorerAddressUrl: z.string().optional(),
      verifier: z.enum(['bitcoin', 'tron', 'solana', 'evm', 'manual']).optional(),
      verifierConfig: z.record(z.unknown()).optional(),
      minConfirmations: z.number().int().min(0).max(100).optional(),
      minAmount: z.string().regex(/^\d+$/).optional(),
      maxAmount: z.string().regex(/^\d+$/).optional(),
      payout2pThreshold: z.string().regex(/^\d+$/).optional(),
      enabled: z.boolean().optional(),
    });

    const body = await parseBody(req, schema);

    // Get existing asset
    const { data: existing, error: fetchErr } = await db()
      .from('custody_assets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return Response.json({ error: 'Asset not found' }, { status: 404 });

    // Validate address_regex if provided
    if (body.addressRegex) {
      try {
        new RegExp(body.addressRegex);
      } catch {
        return Response.json({ error: 'Invalid addressRegex pattern' }, { status: 400 });
      }
    }

    // Validate explorer URL
    if (body.explorerTxUrl && !body.explorerTxUrl.includes('{hash}')) {
      return Response.json({ error: 'explorerTxUrl must contain {hash} placeholder' }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.chainKey !== undefined) updates.chain_key = body.chainKey;
    if (body.chainName !== undefined) updates.chain_name = body.chainName;
    if (body.symbol !== undefined) updates.symbol = body.symbol;
    if (body.name !== undefined) updates.name = body.name;
    if (body.decimals !== undefined) updates.decimals = body.decimals;
    if (body.kind !== undefined) updates.kind = body.kind;
    if (body.tokenId !== undefined) updates.token_id = body.tokenId || null;
    if (body.depositAddress !== undefined) updates.deposit_address = body.depositAddress;
    if (body.addressRegex !== undefined) updates.address_regex = body.addressRegex || null;
    if (body.explorerTxUrl !== undefined) updates.explorer_tx_url = body.explorerTxUrl || null;
    if (body.explorerAddressUrl !== undefined) updates.explorer_address_url = body.explorerAddressUrl || null;
    if (body.verifier !== undefined) updates.verifier = body.verifier;
    if (body.verifierConfig !== undefined) updates.verifier_config = body.verifierConfig;
    if (body.minConfirmations !== undefined) updates.min_confirmations = body.minConfirmations;
    if (body.minAmount !== undefined) updates.min_amount = body.minAmount;
    if (body.maxAmount !== undefined) updates.max_amount = body.maxAmount || null;
    if (body.payout2pThreshold !== undefined) updates.payout_2p_threshold = body.payout2pThreshold || null;
    if (body.enabled !== undefined) updates.enabled = body.enabled;

    const { data: updated, error: updateErr } = await db()
      .from('custody_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Audit log: capture before/after, especially for deposit_address change
    await auditLog(admin.id, 'custody_asset.update', { type: 'custody_asset', id }, existing, updated);

    return Response.json({ asset: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/admin/custody/assets/[id] — delete asset (admin)
 * Only allowed if no legs reference this asset.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('admin');
    const { id } = params;

    // Check if any legs reference this asset
    const { count } = await db()
      .from('custody_legs')
      .select('id', { count: 'exact', head: true })
      .eq('asset_id', id);

    if (count && count > 0) {
      return Response.json(
        { error: 'Cannot delete asset with existing legs. Disable it instead.' },
        { status: 409 },
      );
    }

    const { data: existing } = await db().from('custody_assets').select('*').eq('id', id).maybeSingle();

    const { error } = await db().from('custody_assets').delete().eq('id', id);

    if (error) throw error;

    await auditLog(admin.id, 'custody_asset.delete', { type: 'custody_asset', id }, existing, null);

    return Response.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
