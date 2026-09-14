/* BarChart.tsx — design.md §80: simple SVG bar chart */

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  className?: string;
}

export function BarChart({ data, height = 120, className = '' }: BarChartProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <svg
      viewBox={`0 0 ${data.length * 40 + 20} ${height}`}
      className={className}
      style={{ width: '100%', height: `${height}px` }}
      role="img"
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * (height - 20);
        const x = i * 40 + 10;
        const y = height - barH - 10;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={28}
              height={barH}
              fill={d.color ?? 'var(--color-brand)'}
              rx={3}
            />
            <text
              x={x + 14}
              y={height - 2}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="10"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
