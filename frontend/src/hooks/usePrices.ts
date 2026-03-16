import { useState, useEffect, useCallback, useRef } from 'react';

export interface PriceInfo {
  price: number;
  change24h: number;
}

export interface PricesState {
  prices: Map<string, PriceInfo>;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
}

const REFRESH_MS = 30_000;

// Binance public 24hr ticker — no API key required, CORS open.
const TICKER_URL = 'https://api.binance.com/api/v3/ticker/24hr';

type RawTicker = { symbol: string; lastPrice: string; priceChangePercent: string };

export function usePrices(
  assets: string[],
  cgPrices?: Map<string, { price: number; change24h: number }>,
): PricesState {
  const [state, setState] = useState<PricesState>({
    prices: new Map(),
    lastUpdated: null,
    loading: true,
    error: null,
  });

  // Keep a stable ref so the interval callback always sees the latest asset list.
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const fetch24hr = useCallback(async () => {
    try {
      const resp = await fetch(TICKER_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const tickers: RawTicker[] = await resp.json();

      const assetSet = new Set(assetsRef.current.map(a => a.toUpperCase()));
      const map = new Map<string, PriceInfo>();

      // Pass 1 — USDT-quoted pairs (primary, exact USD price).
      // Skip entries where Binance reports price 0 (delisted/no liquidity pairs).
      for (const t of tickers) {
        if (!t.symbol.endsWith('USDT')) continue;
        const price = parseFloat(t.lastPrice);
        if (price === 0) continue;
        const asset = t.symbol.slice(0, -4).toUpperCase();
        if (!assetSet.has(asset)) continue;
        map.set(asset, { price, change24h: parseFloat(t.priceChangePercent) });
      }

      // Pass 2 — FDUSD-quoted pairs for assets still unmatched.
      // FDUSD ≈ $1.00 so no conversion is required.
      for (const t of tickers) {
        if (!t.symbol.endsWith('FDUSD')) continue;
        const price = parseFloat(t.lastPrice);
        if (price === 0) continue;
        const asset = t.symbol.slice(0, -5).toUpperCase();
        if (!assetSet.has(asset) || map.has(asset)) continue;
        map.set(asset, { price, change24h: parseFloat(t.priceChangePercent) });
      }

      // USDT itself is Binance's quote currency — no xxxxxUSDT pair exists for it.
      // Pin it to $1.00 with ~0% change (it's the peg reference).
      if (assetSet.has('USDT') && !map.has('USDT')) {
        map.set('USDT', { price: 1.0, change24h: 0 });
      }

      // Pass 3 — CoinGecko fallback for assets still missing after both Binance passes
      // (e.g. DAI, which Binance delisted from active spot trading).
      if (cgPrices) {
        for (const asset of assetSet) {
          if (!map.has(asset) && cgPrices.has(asset)) {
            map.set(asset, cgPrices.get(asset)!);
          }
        }
      }

      setState({ prices: map, lastUpdated: new Date(), loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
    }
  }, []);

  useEffect(() => {
    fetch24hr();
    const id = setInterval(fetch24hr, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetch24hr]);

  return state;
}
