import { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';

const STORAGE_KEY = 'earn-tracker-disclaimer-accepted';

export default function DisclaimerBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop blur overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 99,
      }} />

      {/* Banner */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(19,23,32,0.92)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(240,185,11,0.25)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        padding: '28px 32px 32px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: 'rgba(240,185,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldAlert size={18} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>
              Before you continue
            </h2>
          </div>

          {/* Disclaimer points */}
          <ul style={{
            listStyle: 'none',
            margin: '0 0 24px',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {[
              {
                icon: '⚠️',
                text: <>
                  <strong>Not affiliated with Binance.</strong>{' '}
                  This is an independent, community-built tool. It is not associated with, endorsed by, or in any way officially connected to Binance or its affiliates.
                </>,
              },
              {
                icon: '📊',
                text: <>
                  <strong>Not financial advice.</strong>{' '}
                  The data shown (APRs, prices, tier rates) is provided for informational purposes only. Always do your own research before making any investment decisions.
                </>,
              },
              {
                icon: '🔓',
                text: <>
                  <strong>Open-source project.</strong>{' '}
                  The source code is publicly available and free to inspect, fork, and contribute to.
                </>,
              },
            ].map(({ icon, text }, i) => (
              <li key={i} style={{
                display: 'flex',
                gap: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.55,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              This message is shown once and will not appear again.
            </span>
            <button
              onClick={accept}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 22px',
                borderRadius: 8,
                background: 'var(--accent)',
                border: 'none',
                color: '#000',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                letterSpacing: '-0.2px',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <X size={14} strokeWidth={3} />
              I Understand
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
