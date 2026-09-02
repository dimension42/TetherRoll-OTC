/**
 * Venue adapters for Roll Order quote engine.
 * Each adapter fetches public P2P ads and returns liquidity data.
 * Both Binance and OKX use UNOFFICIAL endpoints — wrap with timeout & defensive parsing.
 * On failure, return health:'down' so the quote engine excludes that venue.
 */

export interface VenueAd {
  price: number; // KRW per asset
  available: number; // asset amount
  minKrw: number;
  maxKrw: number;
}

export interface VenueQuote {
  health: 'up' | 'down';
  ads: VenueAd[];
  error?: string;
}

export interface VenueAdapter {
  id: string;
  name: string;
  fetchAds(asset: string, side: 'BUY' | 'SELL'): Promise<VenueQuote>;
}

// 30s in-memory cache for ad books
interface CacheEntry {
  data: VenueQuote;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function getCached(key: string): VenueQuote | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCache(key: string, data: VenueQuote) {
  cache.set(key, { data, expiresAt: Date.now() + 30_000 });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ============================================================================
// Binance P2P
// ============================================================================

export const binanceAdapter: VenueAdapter = {
  id: 'binance-p2p',
  name: 'Binance P2P',

  async fetchAds(asset: string, side: 'BUY' | 'SELL'): Promise<VenueQuote> {
    const cacheKey = `binance:${asset}:${side}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      // POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
      const tradeType = side === 'BUY' ? 'SELL' : 'BUY'; // flip: user BUY = we buy from SELL ads
      const body = {
        asset,
        fiat: 'KRW',
        tradeType,
        page: 1,
        rows: 20,
        payTypes: [],
        publisherType: null,
      };

      const res = await fetchWithTimeout('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const adsData = json?.data ?? [];
      const ads: VenueAd[] = adsData
        .map((raw: unknown) => {
          try {
            const ad = raw as { adv?: Record<string, string | number | undefined> };
            const price = parseFloat(String(ad.adv?.price ?? ''));
            const available = parseFloat(String(ad.adv?.surplusAmount ?? ''));
            const minSingleTransAmount = parseFloat(String(ad.adv?.minSingleTransAmount ?? '0'));
            const maxSingleTransAmount = parseFloat(String(ad.adv?.maxSingleTransAmount ?? '0'));
            if (!price || !available) return null;
            return {
              price,
              available,
              minKrw: minSingleTransAmount * price,
              maxKrw: maxSingleTransAmount * price,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as VenueAd[];

      const result: VenueQuote = { health: 'up', ads };
      setCache(cacheKey, result);
      return result;
    } catch (e) {
      const result: VenueQuote = {
        health: 'down',
        ads: [],
        error: e instanceof Error ? e.message : 'Fetch failed',
      };
      setCache(cacheKey, result);
      return result;
    }
  },
};

// ============================================================================
// OKX P2P
// ============================================================================

export const okxAdapter: VenueAdapter = {
  id: 'okx-p2p',
  name: 'OKX P2P',

  async fetchAds(asset: string, side: 'BUY' | 'SELL'): Promise<VenueQuote> {
    const cacheKey = `okx:${asset}:${side}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      // GET https://www.okx.com/v3/c2c/tradingOrders/books?quoteCurrency=KRW&baseCurrency=USDT&side=sell&...
      const okxSide = side === 'BUY' ? 'sell' : 'buy'; // flip
      const url = new URL('https://www.okx.com/v3/c2c/tradingOrders/books');
      url.searchParams.set('quoteCurrency', 'KRW');
      url.searchParams.set('baseCurrency', asset);
      url.searchParams.set('side', okxSide);
      url.searchParams.set('paymentMethod', 'all');
      url.searchParams.set('userType', 'all');
      url.searchParams.set('showTrade', 'false');
      url.searchParams.set('receivingAds', 'false');
      url.searchParams.set('urlId', '1');

      const res = await fetchWithTimeout(url.toString(), { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const adsData = json?.data?.buy ?? json?.data?.sell ?? [];
      const ads: VenueAd[] = adsData
        .map((raw: unknown) => {
          try {
            const ad = raw as Record<string, string | number | undefined>;
            const price = parseFloat(String(ad.price ?? ''));
            const available = parseFloat(String(ad.availableAmount ?? ''));
            const quoteMinAmountPerOrder = parseFloat(String(ad.quoteMinAmountPerOrder ?? '0'));
            const quoteMaxAmountPerOrder = parseFloat(String(ad.quoteMaxAmountPerOrder ?? '0'));
            if (!price || !available) return null;
            return {
              price,
              available,
              minKrw: quoteMinAmountPerOrder || 0,
              maxKrw: quoteMaxAmountPerOrder || available * price,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as VenueAd[];

      const result: VenueQuote = { health: 'up', ads };
      setCache(cacheKey, result);
      return result;
    } catch (e) {
      const result: VenueQuote = {
        health: 'down',
        ads: [],
        error: e instanceof Error ? e.message : 'Fetch failed',
      };
      setCache(cacheKey, result);
      return result;
    }
  },
};

export const VENUE_ADAPTERS: Record<string, VenueAdapter> = {
  'binance-p2p': binanceAdapter,
  'okx-p2p': okxAdapter,
};
