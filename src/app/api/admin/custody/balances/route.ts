import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Get on-chain balance for Bitcoin
 */
async function getBitcoinBalance(address: string, config: Record<string, unknown>): Promise<bigint | null> {
  try {
    const apiBase = (config.apiBase as string) || 'https://mempool.space/api';
    const res = await fetchWithTimeout(`${apiBase}/address/${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    const funded = BigInt(data.chain_stats?.funded_txo_sum || 0);
    const spent = BigInt(data.chain_stats?.spent_txo_sum || 0);
    return funded - spent;
  } catch {
    return null;
  }
}

/**
 * Get on-chain balance for Tron
 */
async function getTronBalance(address: string, config: Record<string, unknown>, tokenId?: string | null): Promise<bigint | null> {
  try {
    const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv as string] : null;
    const headers: HeadersInit = apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {};
    const apiBase = (config.apiBase as string) || 'https://api.trongrid.io';

    if (tokenId) {
      // TRC-20
      const res = await fetchWithTimeout(`${apiBase}/v1/accounts/${address}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      const token = data.data?.[0]?.trc20?.find((t: { key?: string }) => t.key === tokenId);
      return token ? BigInt(token.value || 0) : BigInt(0);
    } else {
      // Native TRX
      const res = await fetchWithTimeout(`${apiBase}/v1/accounts/${address}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return BigInt(data.data?.[0]?.balance || 0);
    }
  } catch {
    return null;
  }
}

/**
 * Get on-chain balance for Solana
 */
async function getSolanaBalance(address: string, config: Record<string, unknown>, tokenId?: string | null): Promise<bigint | null> {
  try {
    const rpcUrl = (config.rpcUrl as string) || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    if (tokenId) {
      // SPL token — get token account
      const res = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [address, { mint: tokenId }, { encoding: 'jsonParsed' }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const accounts = data.result?.value || [];
      if (accounts.length === 0) return BigInt(0);
      const balance = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.amount;
      return balance ? BigInt(balance) : BigInt(0);
    } else {
      // Native SOL
      const res = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.result?.value ? BigInt(data.result.value) : null;
    }
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/custody/balances — show balances per asset (viewer)
 */
export async function GET() {
  try {
    await requireRole('viewer');

    // Get all enabled assets
    const { data: assets, error: assetsErr } = await db()
      .from('custody_assets')
      .select('*')
      .eq('enabled', true);

    if (assetsErr) throw assetsErr;

    const balances = await Promise.all(
      (assets || []).map(async asset => {
        // DB held: sum of CONFIRMED legs that haven't been paid out yet
        const { data: confirmedLegs } = await db()
          .from('custody_legs')
          .select('amount')
          .eq('asset_id', asset.id)
          .eq('status', 'CONFIRMED');

        const dbHeld = (confirmedLegs || []).reduce((sum, leg) => sum + BigInt(leg.amount), BigInt(0));

        // Pending payouts: sum of REQUESTED + APPROVED
        const { data: pendingPayouts } = await db()
          .from('custody_payouts')
          .select('amount')
          .eq('asset_id', asset.id)
          .in('status', ['REQUESTED', 'APPROVED']);

        const pending = (pendingPayouts || []).reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));

        // On-chain balance
        let onchainBalance: bigint | null = null;

        if (asset.verifier === 'bitcoin') {
          onchainBalance = await getBitcoinBalance(asset.deposit_address, asset.verifier_config);
        } else if (asset.verifier === 'tron') {
          onchainBalance = await getTronBalance(asset.deposit_address, asset.verifier_config, asset.token_id);
        } else if (asset.verifier === 'solana') {
          onchainBalance = await getSolanaBalance(asset.deposit_address, asset.verifier_config, asset.token_id);
        }
        // evm/manual → null

        const diff = onchainBalance !== null ? onchainBalance - dbHeld - pending : null;

        return {
          asset: {
            id: asset.id,
            symbol: asset.symbol,
            chain_key: asset.chain_key,
            chain_name: asset.chain_name,
            decimals: asset.decimals,
            deposit_address: asset.deposit_address,
          },
          dbHeld: dbHeld.toString(),
          pendingPayouts: pending.toString(),
          onchainBalance: onchainBalance?.toString() || null,
          diff: diff?.toString() || null,
        };
      }),
    );

    return Response.json({ balances });
  } catch (e) {
    return handleApiError(e);
  }
}
