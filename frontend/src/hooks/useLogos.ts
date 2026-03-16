import { useState, useEffect } from 'react';

// Fetch top 500 coins by market cap from CoinGecko — no API key required, CORS open.
// This covers virtually every asset listed on Binance Flexible Earn.
const BASE =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&price_change_percentage=24h&per_page=250&page=';

type CoinMarket = {
  symbol: string;
  image: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
};

export interface CoinGeckoData {
  logos: Map<string, string>;
  /** Fallback prices for assets not available on Binance (e.g. delisted pairs). */
  cgPrices: Map<string, { price: number; change24h: number }>;
}

export function useCoinGeckoData(): CoinGeckoData {
  const [result, setResult] = useState<CoinGeckoData>({
    logos: new Map(),
    cgPrices: new Map(),
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch pages 1 & 2 in parallel (= top 500 by market cap).
        const [p1, p2] = await Promise.all([
          fetch(BASE + '1').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<CoinMarket[]>; }),
          fetch(BASE + '2').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<CoinMarket[]>; }),
        ]);

        if (cancelled) return;

        const logos = new Map<string, string>();
        const cgPrices = new Map<string, { price: number; change24h: number }>();

        for (const coin of [...p1, ...p2]) {
          const sym = coin.symbol?.toUpperCase();
          if (!sym) continue;

          // Keep the first match per symbol (highest market cap wins on collision).
          if (coin.image && !logos.has(sym)) {
            // CoinGecko returns "large" images; swap to "small" (27 px) for performance.
            logos.set(sym, coin.image.replace('/large/', '/small/'));
          }
          if (!cgPrices.has(sym) && coin.current_price != null && coin.current_price > 0) {
            cgPrices.set(sym, {
              price: coin.current_price,
              change24h: coin.price_change_percentage_24h ?? 0,
            });
          }
        }

        setResult({ logos, cgPrices });
      } catch (e) {
        // Non-critical — the UI falls back to letter avatars and no prices.
        console.warn('Could not fetch CoinGecko data:', e);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return result;
}

/** Convenience alias — keeps old call sites working. */
export function useLogos(): Map<string, string> {
  return useCoinGeckoData().logos;
}
