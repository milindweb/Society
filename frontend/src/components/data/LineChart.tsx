/* LineChart.tsx — design.md §80: simple SVG line chart */

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  className?: string;
}

export function LineChart({ data, height = 120, color = 'var(--color-brand)', className = '' }: LineChartProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const width = data.length * 40 + 20;
  const points = data
    .map((d, i) => {
      const x = i * 40 + 20;
      const y = height - (d.value / maxVal) * (height - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: '100%', height: `${height}px` }}
      role="img"
      aria-label="Line chart"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = i * 40 + 20;
        const y = height - (d.value / maxVal) * (height - 20) - 10;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill={color} />
            <text x={x} y={height - 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
