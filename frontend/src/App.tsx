import { useState, useEffect, useMemo } from 'react';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  Flame, TrendingUp, Coins, RefreshCw, CheckCircle2, Layers, Wifi,
} from 'lucide-react';
import type { EarnData, FlexibleProduct, SortDir, SortKey, FilterStatus } from './types';
import ProductRow from './components/ProductRow';
import StatCard from './components/StatCard';
import { usePrices } from './hooks/usePrices';
import { useCoinGeckoData } from './hooks/useLogos';
import DisclaimerBanner from './components/DisclaimerBanner';

function hasTiers(tiers: Record<string, string> | null | undefined) {
  return !!tiers && Object.keys(tiers).length > 0;
}

function SortIcon({ col, active, dir }: { col: string; active: string; dir: SortDir }) {
  if (col !== active) return <ArrowUpDown size={13} style={{ opacity: 0.35 }} />;
  return dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
}

function LiveBadge({ lastUpdated, error }: { lastUpdated: Date | null; error: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--red)', background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', borderRadius: 6, padding: '4px 10px' }}>
      <Wifi size={11} /> Prices unavailable
    </div>
  );

  const secsAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--green)', background: 'rgba(14,203,129,0.08)', border: '1px solid rgba(14,203,129,0.2)', borderRadius: 6, padding: '4px 10px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
      Live prices · {secsAgo !== null ? `${secsAgo}s ago` : 'loading…'}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

const PAGE_SIZE = 50;

export default function App() {
  const [data, setData] = useState<EarnData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('apr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'flexible-earn.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  const assets = useMemo(() => data?.products.map(p => p.asset) ?? [], [data]);
  const { logos, cgPrices } = useCoinGeckoData();
  const { prices, lastUpdated, error: priceError } = usePrices(assets, cgPrices);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  const stablecoinSet = useMemo(
    () => new Set((data?.stablecoins ?? []).map(s => s.toUpperCase())),
    [data],
  );

  const filtered = useMemo<FlexibleProduct[]>(() => {
    if (!data) return [];
    let list = data.products;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.asset.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q));
    }

    switch (filter) {
      case 'available':   list = list.filter(p => p.canPurchase && !p.isSoldOut); break;
      case 'soldout':     list = list.filter(p => p.isSoldOut); break;
      case 'hot':         list = list.filter(p => p.hot); break;
      case 'stablecoin':  list = list.filter(p => stablecoinSet.has(p.asset.toUpperCase())); break;
      case 'has-tiers':   list = list.filter(p => hasTiers(p.tierAnnualPercentageRate)); break;
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'asset':       cmp = a.asset.localeCompare(b.asset); break;
        case 'apr':         cmp = parseFloat(a.latestAnnualPercentageRate) - parseFloat(b.latestAnnualPercentageRate); break;
        case 'minPurchase': cmp = parseFloat(a.minPurchaseAmount) - parseFloat(b.minPurchaseAmount); break;
        case 'price': {
          const pa = prices.get(a.asset.toUpperCase())?.price ?? -1;
          const pb = prices.get(b.asset.toUpperCase())?.price ?? -1;
          cmp = pa - pb; break;
        }
        case 'change24h': {
          const ca = prices.get(a.asset.toUpperCase())?.change24h ?? -Infinity;
          const cb = prices.get(b.asset.toUpperCase())?.change24h ?? -Infinity;
          cmp = ca - cb; break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [data, search, sortKey, sortDir, filter, stablecoinSet, prices]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const stats = useMemo(() => {
    if (!data) return null;
    const p = data.products;
    const available   = p.filter(x => x.canPurchase && !x.isSoldOut).length;
    const hot         = p.filter(x => x.hot).length;
    const withTiers   = p.filter(x => hasTiers(x.tierAnnualPercentageRate)).length;
    const stablecoins = p.filter(x => stablecoinSet.has(x.asset.toUpperCase())).length;
    const topAPR      = Math.max(...p.map(x => parseFloat(x.latestAnnualPercentageRate))) * 100;
    const avgAPR      = (p.reduce((s, x) => s + parseFloat(x.latestAnnualPercentageRate), 0) / p.length) * 100;
    return { available, hot, withTiers, stablecoins, topAPR, avgAPR };
  }, [data, stablecoinSet]);

  const thStyle: React.CSSProperties = {
    padding: '12px 16px',
    textAlign: 'left',
    color: 'var(--muted)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  };

  const sortableThStyle = (key: SortKey): React.CSSProperties => ({
    ...thStyle,
    cursor: 'pointer',
    userSelect: 'none',
    color: sortKey === key ? 'var(--accent)' : 'var(--muted)',
  });

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 20,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'rgba(240,185,11,0.1)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--muted)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: 'var(--red)' }}>
      <RefreshCw size={32} />
      <p style={{ fontSize: 16 }}>Failed to load data: {error}</p>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Make sure <code>public/flexible-earn.json</code> exists.</p>
    </div>
  );

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: 'var(--muted)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      Loading earn data…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '28px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <img
              src="/android-chrome-192x192.png"
              alt="Earn tracker icon"
              width={36}
              height={36}
              style={{ borderRadius: 8 }}
            />
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>
              Binance Flexible Earn Tracker
            </h1>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {data.total} tokens with flexible earn products
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <LiveBadge lastUpdated={lastUpdated} error={priceError} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--muted)',
          }}>
            <RefreshCw size={12} />
            Earn data: {new Date(data.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="Total Products"  value={data.total}                    icon={<Coins size={20} />} />
          <StatCard label="Available Now"   value={stats.available}               icon={<CheckCircle2 size={20} />} accent />
          <StatCard label="Hot Products"    value={stats.hot}                     icon={<Flame size={20} />} />
          <StatCard label="Stablecoins"     value={stats.stablecoins}             icon={<span style={{ fontSize: 18 }}>💵</span>} />
          <StatCard label="With Tier APR"   value={stats.withTiers}               icon={<Layers size={20} />} accent />
          <StatCard label="Highest APR"     value={`${stats.topAPR.toFixed(2)}%`} icon={<TrendingUp size={20} />} accent />
          <StatCard label="Average APR"     value={`${stats.avgAPR.toFixed(2)}%`} icon={<TrendingUp size={20} />} />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search asset or product ID…"
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)', paddingLeft: 4 }}>Status</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['all',       'All'],
                ['available', '✓ Available'],
                ['soldout',   '✗ Sold Out'],
                ['hot',       '🔥 Hot'],
              ] as [FilterStatus, string][]).map(([f, label]) => (
                <button key={f} style={filterBtnStyle(filter === f)} onClick={() => { setFilter(f); setPage(1); }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)', paddingLeft: 4 }}>Type</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['stablecoin', '💵 Stablecoins'],
                ['has-tiers',  '📊 Has Tier APR'],
              ] as [FilterStatus, string][]).map(([f, label]) => (
                <button key={f} style={filterBtnStyle(filter === f)} onClick={() => { setFilter(f); setPage(1); }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 13, alignSelf: 'flex-end', paddingBottom: 2 }}>
          {filtered.length} results
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th className="col-asset" style={sortableThStyle('asset')} onClick={() => handleSort('asset')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    Asset <SortIcon col="asset" active={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th className="col-price" style={sortableThStyle('price')} onClick={() => handleSort('price')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    Price <SortIcon col="price" active={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th style={sortableThStyle('apr')} onClick={() => handleSort('apr')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    APR <SortIcon col="apr" active={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th style={thStyle}>Tier APR</th>
                <th className="col-min-purchase" style={sortableThStyle('minPurchase')} onClick={() => handleSort('minPurchase')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    Min. Purchase <SortIcon col="minPurchase" active={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th className="col-status" style={thStyle}>Status</th>
                <th className="col-actions" style={thStyle}>Actions</th>
                <th className="col-airdrop" style={thStyle}>Airdrop Bonus</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
                    No products match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map(p => (
                  <ProductRow
                    key={p.productId}
                    product={p}
                    priceInfo={prices.get(p.asset.toUpperCase())}
                    logoUrl={logos.get(p.asset.toUpperCase())}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setPage(pg => pg + 1)}
              style={{
                padding: '8px 28px', borderRadius: 8,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', cursor: 'pointer', fontSize: 13,
              }}
            >
              Load more ({filtered.length - paginated.length} remaining)
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
        Prices live from Binance public API · Logos from CoinGecko · Earn data updated by CI · Not affiliated with Binance · Not financial advice
      </div>

      <DisclaimerBanner />
    </div>
  );
}
