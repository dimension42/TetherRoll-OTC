import { db } from '@/lib/db';
import { VENUE_ADAPTERS, type VenueAd } from './venue-adapters';
import { ROLL_CHAINS, type RollChainKey } from '@/lib/tokens';

/**
 * Roll Order quote engine.
 * Aggregates liquidity from enabled venues, computes fee breakdown, stores quote in DB.
 */

export interface QuoteVenue {
  id: string;
  name: string;
  share: number; // 0-100%
  rate: number; // weighted KRW per asset
  amountKrw: number;
  amountAsset: number;
}

export interface QuoteResult {
  quoteId: string;
  venues: QuoteVenue[];
  coveragePct: number; // how much of the requested amount can be filled
  venuesDown: string[]; // venue IDs that failed health check
  execCost: number; // weighted venue cost
  feePlatform: number; // spread on top of execCost
  feeGas: number; // estimated gas fee
  total: number; // execCost + feePlatform + feeGas
  expiresAt: string; // ISO
}

interface QuoteInput {
  side: 'BUY' | 'SELL';
  asset: string;
  chain: RollChainKey;
  amountKrw: number;
  slippageBps?: number;
}

export async function generateQuote(userId: string, input: QuoteInput): Promise<QuoteResult> {
  // 1. Fetch enabled venues
  const { data: venuesData } = await db().from('venues').select('*').eq('enabled', true);
  if (!venuesData || venuesData.length === 0) {
    throw new Error('No venues enabled');
  }

  // 2. Fetch latest fee configs
  const { data: feeConfigs } = await db()
    .from('fee_configs')
    .select('*')
    .in('key', ['spread_bps', 'gas_margin_pct'])
    .order('created_at', { ascending: false });
  const spreadBps =
    parseFloat(feeConfigs?.find(f => f.key === 'spread_bps' && !f.venue_id)?.value ?? '50');
  const gasMarginPct = parseFloat(feeConfigs?.find(f => f.key === 'gas_margin_pct')?.value ?? '10');

  // 3. Fetch ad books from venues
  const venueQuotes = await Promise.all(
    venuesData.map(async v => {
      const adapter = VENUE_ADAPTERS[v.adapter_key];
      if (!adapter) return { venue: v, health: 'down' as const, ads: [] };
      const quote = await adapter.fetchAds(input.asset, input.side);
      return { venue: v, ...quote };
    }),
  );

  const venuesDown = venueQuotes.filter(vq => vq.health === 'down').map(vq => vq.venue.id);
  const healthyVenues = venueQuotes.filter(vq => vq.health === 'up');

  if (healthyVenues.length === 0) {
    throw new Error('All venues are down');
  }

  // 4. Greedy allocation across ads (sorted best price first)
  const allAds: Array<VenueAd & { venueId: string; venueName: string }> = [];
  healthyVenues.forEach(vq => {
    vq.ads.forEach(ad => {
      allAds.push({ ...ad, venueId: vq.venue.id, venueName: vq.venue.name });
    });
  });

  // BUY(KRW→asset): 낮은 KRW/asset 가격이 유리 → 오름차순. SELL(asset→KRW): 높은 가격이 유리 → 내림차순.
  allAds.sort((a, b) => (input.side === 'BUY' ? a.price - b.price : b.price - a.price));

  let remainingKrw = input.amountKrw;
  const allocations: Array<{
    venueId: string;
    venueName: string;
    amountKrw: number;
    amountAsset: number;
    rate: number;
    spreadBps: number;
  }> = [];

  for (const ad of allAds) {
    if (remainingKrw <= 0) break;
    // Check venue-specific override
    // 체결 원가는 venue 원시 호가로 계산하고, 플랫폼 스프레드는 별도 항목(feePlatform)으로 분리 표기한다 (PRD §1.2).
    const venueOverride = venuesData.find(v => v.id === ad.venueId)?.fee_override_bps;
    const effectiveSpreadBps = venueOverride ?? spreadBps;
    const rate = ad.price;

    const maxAsset = Math.min(ad.available, ad.maxKrw / rate);
    const maxKrwForThisAd = Math.min(remainingKrw, ad.maxKrw, maxAsset * rate);

    if (maxKrwForThisAd < ad.minKrw) continue; // skip if below min

    const assetAmount = maxKrwForThisAd / rate;
    allocations.push({
      venueId: ad.venueId,
      venueName: ad.venueName,
      amountKrw: maxKrwForThisAd,
      amountAsset: assetAmount,
      rate,
      spreadBps: effectiveSpreadBps,
    });
    remainingKrw -= maxKrwForThisAd;
  }

  // 5. Aggregate by venue
  const venueMap = new Map<string, QuoteVenue>();
  allocations.forEach(a => {
    const existing = venueMap.get(a.venueId);
    if (existing) {
      const totalKrw = existing.amountKrw + a.amountKrw;
      const totalAsset = existing.amountAsset + a.amountAsset;
      existing.amountKrw = totalKrw;
      existing.amountAsset = totalAsset;
      existing.rate = totalKrw / totalAsset; // weighted
    } else {
      venueMap.set(a.venueId, {
        id: a.venueId,
        name: a.venueName,
        share: 0, // computed below
        rate: a.rate,
        amountKrw: a.amountKrw,
        amountAsset: a.amountAsset,
      });
    }
  });

  const venues = Array.from(venueMap.values());
  const filledKrw = venues.reduce((sum, v) => sum + v.amountKrw, 0);
  const coveragePct = (filledKrw / input.amountKrw) * 100;
  venues.forEach(v => {
    v.share = (v.amountKrw / filledKrw) * 100;
  });

  // 6. Compute fees
  const execCost = filledKrw;
  // 플랫폼 수수료 = Σ(배분액 × 해당 venue 스프레드 bps). venue 오버라이드 반영.
  const feePlatform = allocations.reduce((sum, a) => sum + a.amountKrw * (a.spreadBps / 10000), 0);

  const chainInfo = ROLL_CHAINS.find(c => c.key === input.chain);
  const gasPerVenue = chainInfo?.gasEstimateKrw ?? 0;
  const feeGas = gasPerVenue * venues.length * (1 + gasMarginPct / 100);

  const total = execCost + feePlatform + feeGas;

  // 7. Store quote
  const expiresAt = new Date(Date.now() + 60_000).toISOString(); // 60s TTL
  const { data: quoteRow } = await db()
    .from('roll_quotes')
    .insert({
      user_id: userId,
      side: input.side,
      asset: input.asset,
      chain: input.chain,
      amount_krw: input.amountKrw,
      slippage_bps: input.slippageBps,
      venues: JSON.stringify(venues),
      est_fee_platform: feePlatform.toString(),
      est_fee_gas: feeGas.toString(),
      total_krw: total.toString(),
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (!quoteRow) throw new Error('Failed to store quote');

  return {
    quoteId: quoteRow.id,
    venues,
    coveragePct,
    venuesDown,
    execCost,
    feePlatform,
    feeGas,
    total,
    expiresAt,
  };
}
