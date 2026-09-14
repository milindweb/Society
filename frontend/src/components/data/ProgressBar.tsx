/* ProgressBar.tsx — design.md §80 */

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, max = 100, color = 'var(--color-brand)', height = 6, className = '', showLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={className}>
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          background: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--motion-normal) var(--ease-standard)',
          }}
        />
      </div>
      {showLabel && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', textAlign: 'right' }}>
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}
