/* DashboardCharts.tsx — Monthly Expense vs Collection line chart */
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { formatMoney } from '@/lib/money';
import type { DashboardSummary } from '@/types/domain';
import type { ChangeEvent } from 'react';

interface DashboardChartsProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

const MONTH_COUNTS = [
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '0', label: 'All time' },
];

function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function DashboardCharts({ summary, loading }: DashboardChartsProps) {
  const [monthCount, setMonthCount] = useState('6');

  const chartData = useMemo(() => {
    const monthly = summary?.finance?.monthly ?? [];
    const expenses = summary?.monthlyExpenses ?? [];

    // Merge expense and collection by month
    const monthMap = new Map<string, { month: string; collection: number; expense: number }>();

    for (const row of monthly) {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { month: row.month, collection: 0, expense: 0 });
      }
      monthMap.get(row.month)!.collection = row.collection;
    }

    for (const row of expenses) {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, { month: row.month, collection: 0, expense: 0 });
      }
      monthMap.get(row.month)!.expense = row.amount;
    }

    let data = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Apply month filter
    const count = Number(monthCount);
    if (count > 0 && data.length > count) {
      data = data.slice(data.length - count);
    }

    return data.map((d) => ({
      ...d,
      label: formatMonth(d.month),
    }));
  }, [summary, monthCount]);

  const hasData = chartData.length > 0;

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardBody>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Expense vs Collection</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Monthly trend</p>
          </div>
          <Select
            value={monthCount}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setMonthCount(e.target.value)}
            options={MONTH_COUNTS}
            style={{ width: 150 }}
          />
        </div>
        {loading ? (
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : !hasData ? (
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => formatMoney(Number(value))}
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}
              />
              <Legend />
              <Line type="monotone" dataKey="collection" name="Collection" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
