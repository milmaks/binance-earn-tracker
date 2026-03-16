interface Props {
  label: string;
  color: 'green' | 'red' | 'yellow' | 'blue' | 'muted';
}

const palette: Record<Props['color'], { bg: string; text: string }> = {
  green:  { bg: 'rgba(14,203,129,0.12)',  text: 'var(--green)' },
  red:    { bg: 'rgba(246,70,93,0.12)',   text: 'var(--red)'   },
  yellow: { bg: 'rgba(240,185,11,0.12)', text: 'var(--accent)' },
  blue:   { bg: 'rgba(43,154,243,0.12)', text: 'var(--blue)'   },
  muted:  { bg: 'var(--surface2)',        text: 'var(--muted)'  },
};

export default function Badge({ label, color }: Props) {
  const { bg, text } = palette[color];
  return (
    <span style={{
      background: bg,
      color: text,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 20,
      whiteSpace: 'nowrap',
      letterSpacing: '0.3px',
    }}>
      {label}
    </span>
  );
}
