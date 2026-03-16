import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: boolean;
}

export default function StatCard({ label, value, icon, accent }: Props) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: accent ? 'rgba(240,185,11,0.12)' : 'var(--surface2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: accent ? 'var(--accent)' : 'var(--muted)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>{value}</div>
      </div>
    </div>
  );
}
