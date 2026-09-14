/* SettingsPage.tsx — FE-13 */

import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardBody } from '@/components/ui/Card';

const settingsTabs = [
  { key: 'society', label: 'Society', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Society config — FE-13.</p></CardBody></Card> },
  { key: 'wings', label: 'Wings', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Wings config — FE-13.</p></CardBody></Card> },
  { key: 'charges', label: 'Charges', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Charge types — FE-13.</p></CardBody></Card> },
  { key: 'interest', label: 'Interest', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Interest rules — FE-13.</p></CardBody></Card> },
  { key: 'categories', label: 'Categories', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Categories — FE-13.</p></CardBody></Card> },
  { key: 'users', label: 'Users', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>User management — FE-13.</p></CardBody></Card> },
  { key: 'roles', label: 'Roles', content: <Card><CardBody><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Role management — FE-13.</p></CardBody></Card> },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="System configuration" />
      <Tabs tabs={settingsTabs} />
    </div>
  );
}
