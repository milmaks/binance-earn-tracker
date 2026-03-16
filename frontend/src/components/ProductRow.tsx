import { useState } from 'react';
import Badge from './Badge';
import TierTable from './TierTable';
import type { FlexibleProduct } from '../types';
import type { PriceInfo } from '../hooks/usePrices';

interface Props {
  product: FlexibleProduct;
  priceInfo: PriceInfo | undefined;
  logoUrl: string | undefined;
}

function formatAPR(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  return (n * 100).toFixed(2) + '%';
}

function aprColor(raw: string): string {
  const n = parseFloat(raw) * 100;
  if (n >= 5) return 'var(--green)';
  if (n >= 1) return 'var(--accent)';
  return 'var(--text)';
}

function formatPrice(price: number): string {
  if (price === 0) return '—';
  if (price < 0.0001) return price.toExponential(2);
  if (price < 0.01)   return `$${price.toFixed(6)}`;
  if (price < 1)      return `$${price.toFixed(4)}`;
  if (price < 1000)   return `$${price.toFixed(2)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(price);
}

function CryptoLogo({ symbol, logoUrl }: { symbol: string; logoUrl: string | undefined }) {
  const [imgError, setImgError] = useState(false);
  const letter = symbol.charAt(0).toUpperCase();
  const hue = [...symbol].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        width={32}
        height={32}
        style={{ borderRadius: '50%', flexShrink: 0 }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: `hsl(${hue},55%,28%)`,
      border: `2px solid hsl(${hue},55%,40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700,
      color: `hsl(${hue},80%,80%)`,
      flexShrink: 0, letterSpacing: '-0.5px',
    }}>
      {letter}
    </div>
  );
}

export default function ProductRow({ product, priceInfo, logoUrl }: Props) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>

      {/* Asset — sticky on mobile */}
      <td className="col-asset" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CryptoLogo symbol={product.asset} logoUrl={logoUrl} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{product.asset}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{product.productId}</div>
          </div>
        </div>
      </td>

      {/* Price — hidden on mobile */}
      <td className="col-price" style={{ padding: '12px 16px' }}>
        {priceInfo ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{formatPrice(priceInfo.price)}</div>
            <div style={{
              fontSize: 11, fontWeight: 600, marginTop: 2,
              color: priceInfo.change24h >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {priceInfo.change24h >= 0 ? '▲' : '▼'} {Math.abs(priceInfo.change24h).toFixed(2)}%
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
        )}
      </td>

      {/* APR — always visible */}
      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 16, color: aprColor(product.latestAnnualPercentageRate) }}>
        {formatAPR(product.latestAnnualPercentageRate)}
        {product.hot && <span style={{ marginLeft: 6, fontSize: 14 }}>🔥</span>}
      </td>

      {/* Tier APR — always visible, next to APR */}
      <td style={{ padding: '8px 16px' }}>
        <TierTable tiers={product.tierAnnualPercentageRate} asset={product.asset} />
      </td>

      {/* Min purchase — hidden on mobile */}
      <td className="col-min-purchase" style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>
        {product.minPurchaseAmount} {product.asset}
      </td>

      {/* Status — hidden on mobile */}
      <td className="col-status" style={{ padding: '12px 16px' }}>
        {product.isSoldOut
          ? <Badge label="Sold Out" color="red" />
          : product.status === 'PURCHASING'
            ? <Badge label="Available" color="green" />
            : <Badge label={product.status} color="muted" />
        }
      </td>

      {/* Actions — hidden on mobile */}
      <td className="col-actions" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {product.canPurchase && <Badge label="Buy" color="blue" />}
          {product.canRedeem  && <Badge label="Redeem" color="blue" />}
        </div>
      </td>

      {/* Airdrop — hidden on mobile */}
      <td className="col-airdrop" style={{ padding: '12px 16px', fontSize: 12 }}>
        {product.airDropPercentageRate
          ? <Badge label={`+${formatAPR(product.airDropPercentageRate)} airdrop`} color="yellow" />
          : <span style={{ opacity: 0.4, color: 'var(--muted)' }}>—</span>
        }
      </td>
    </tr>
  );
}
