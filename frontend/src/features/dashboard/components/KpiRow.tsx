/* KpiRow.tsx — Dashboard KPI row (FE-04)
 * SRS §2: total flats/members, total monthly demand, total collection, outstanding, overdue.
 * design.md §6: PageHeader -> KPI row -> primary data -> recent activity.
 * design.md §8: status colours via tokens; no per-KPI bright colours. */

import { KpiCard } from '@/components/data/KpiCard';
import { Icon } from '@/components/ui/Icon';
import { formatMoney } from '@/lib/money';
import type { DashboardSummary } from '@/types/domain';

interface KpiRowProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

const PLACEHOLDER = '…';

export function KpiRow({ summary, loading }: KpiRowProps) {
  const fm = summary?.flatsMembers;
  const finance = summary?.finance;

  const value = (v: string | number) => (loading ? PLACEHOLDER : v);

  return (
    <div
      className="hs-grid hs-grid-cols-2 hs-lg-grid-cols-4"
      style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}
    >
      <KpiCard
        label="Total Flats"
        value={value(fm?.totalFlats ?? 0)}
        icon={<Icon name="flats" />}
      />
      <KpiCard
        label="Total Expenses"
        value={value(formatMoney(summary?.totalExpenses ?? 0))}
        icon={<Icon name="expenses" />}
      />
      <KpiCard
        label="Monthly Demand"
        value={value(formatMoney(finance?.totalDemand ?? 0))}
        icon={<Icon name="maintenance" />}
      />
      <KpiCard
        label="Total Collection"
        value={value(formatMoney(finance?.totalCollection ?? 0))}
        icon={<Icon name="payments" />}
      />
      <KpiCard
        label="Outstanding"
        value={value(formatMoney(finance?.totalOutstanding ?? 0))}
        icon={<Icon name="alert" />}
      />
      <KpiCard
        label="Overdue Amount"
        value={value(formatMoney(finance?.overdueAmount ?? 0))}
        icon={<Icon name="warning" />}
      />
      <KpiCard
        label="Paid Members"
        value={value(summary?.counts?.paidMembers ?? 0)}
        icon={<Icon name="success" />}
      />
      <KpiCard
        label="Pending Members"
        value={value(summary?.counts?.pendingMembers ?? 0)}
        icon={<Icon name="clock" />}
      />
    </div>
  );
}
