/* DonutChart.tsx — design.md §80: simple SVG donut chart */

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  className?: string;
}

export function DonutChart({ segments, size = 120, className = '' }: DonutChartProps) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Donut chart"
    >
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const currentOffset = offset;
        offset += dash;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-currentOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill="var(--color-text)" fontSize="16" fontWeight="600">
        {total}
      </text>
    </svg>
  );
}
