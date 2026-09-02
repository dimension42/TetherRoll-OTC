import { db } from '@/lib/db';
import type { CustodyAsset, CustodyAssetPublic } from './types';

/** Get all enabled custody assets (internal, includes deposit addresses) */
export async function getEnabledAssets(): Promise<CustodyAsset[]> {
  const { data, error } = await db()
    .from('custody_assets')
    .select('*')
    .eq('enabled', true)
    .order('chain_name', { ascending: true })
    .order('symbol', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CustodyAsset[];
}

/** Get a single asset by ID (internal) */
export async function getAsset(id: string): Promise<CustodyAsset | null> {
  const { data, error } = await db()
    .from('custody_assets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as CustodyAsset | null;
}

/** Project to public view (remove sensitive fields) */
export function toPublicAsset(asset: CustodyAsset): CustodyAssetPublic {
  return {
    id: asset.id,
    chain_key: asset.chain_key,
    chain_name: asset.chain_name,
    symbol: asset.symbol,
    name: asset.name,
    decimals: asset.decimals,
    kind: asset.kind,
    token_id: asset.token_id,
    explorer_tx_url: asset.explorer_tx_url,
    explorer_address_url: asset.explorer_address_url,
    verifier: asset.verifier,
    min_confirmations: asset.min_confirmations,
    min_amount: asset.min_amount,
    max_amount: asset.max_amount,
  };
}
