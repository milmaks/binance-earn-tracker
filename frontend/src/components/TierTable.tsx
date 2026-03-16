import type { TierAPR } from '../types';

interface Props {
  tiers: TierAPR | null | undefined;
  asset: string;
}

interface ParsedTier {
  raw: string;
  label: string;
  apr: number;
  aprStr: string;
  isHighest: boolean;
  isLowest: boolean;
}

/**
 * Parses a tier key returned by Binance.
 *
 * Two formats are observed:
 *  - Range keys:   "0-200USDC"  →  label "0 – 200 USDC"
 *  - Summary keys: "highestRate" / "lowestRate"
 */
function parseTiers(tiers: TierAPR): ParsedTier[] {
  const entries = Object.entries(tiers).filter(([, v]) => v !== '' && parseFloat(v) > 0);
  if (entries.length === 0) return [];

  const isSummary = entries.some(([k]) => k === 'highestRate' || k === 'lowestRate');

  return entries
    .map(([key, value]): ParsedTier => {
      const apr = parseFloat(value) * 100;
      const aprStr = `${apr.toFixed(2)}%`;

      if (isSummary) {
        return {
          raw: key,
          label: key === 'highestRate' ? 'Highest tier' : 'Lowest tier',
          apr,
          aprStr,
          isHighest: key === 'highestRate',
          isLowest: key === 'lowestRate',
        };
      }

      // Range key e.g. "0-200USDC" or "200-INF USDC"
      const match = key.match(/^([\d.]+)-([\d.]+|INF)\s*([A-Z0-9]+)$/i);
      let label = key;
      if (match) {
        const [, lo, hi, sym] = match;
        const hiLabel = hi.toUpperCase() === 'INF' ? '∞' : Number(hi).toLocaleString();
        label = `${Number(lo).toLocaleString()} – ${hiLabel} ${sym.toUpperCase()}`;
      }

      return { raw: key, label, apr, aprStr, isHighest: false, isLowest: false };
    })
    .sort((a, b) => {
      // Sort range tiers by lower bound; summary tiers by APR descending
      const aMatch = a.raw.match(/^([\d.]+)/);
      const bMatch = b.raw.match(/^([\d.]+)/);
      if (aMatch && bMatch) return parseFloat(aMatch[1]) - parseFloat(bMatch[1]);
      return b.apr - a.apr;
    });
}

function aprColor(apr: number): string {
  if (apr >= 5) return 'var(--green)';
  if (apr >= 1) return 'var(--accent)';
  return 'var(--text)';
}

export default function TierTable({ tiers, asset: _ }: Props) {
  const rows = parseTiers(tiers ?? {});

  if (rows.length === 0) {
    return <span style={{ opacity: 0.35, color: 'var(--muted)', fontSize: 12 }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(row => (
        <div
          key={row.raw}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            //background: 'var(--surface2)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 12,
            maxWidth: '70%',
          }}
        >
          <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{row.label}</span>
          <span style={{ fontWeight: 700, color: aprColor(row.apr), whiteSpace: 'nowrap' }}>
            {row.aprStr}
          </span>
        </div>
      ))}
    </div>
  );
}
