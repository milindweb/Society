/* SettingsPage.tsx — FE-13 Settings & Configuration
 *
 * The landing page for every configuration surface. Two kinds of tab:
 *
 *   1. "Society"  — the seeded Society_Config key/value store
 *                   (`config.get` / `config.update`).
 *   2. One tab per master entity — all 24 of them, discovered at runtime from
 *      `config.entityMeta`. Nothing about wings, charge types, vendors or roles
 *      is written here; the tab list and every form come from `SchemaMeta`
 *      on the server (SRS §15).
 *
 * Two deliberate implementation decisions:
 *
 * - `Tabs` is used for NAVIGATION ONLY. Its `content` prop is a `ReactNode`, so
 *   every tab's subtree is constructed eagerly — handing it 25 panels would
 *   fire 25 concurrent `config.entity.list` requests on mount. Instead the tab
 *   descriptors carry keys and one panel is rendered below. `Tabs` is given
 *   empty content for that reason.
 *
 * - The active tab lives in the URL (`/settings/entities/wings`), so a
 *   configuration screen is linkable and the back button works. The route
 *   parameter is validated against the fetched catalog; an unknown entity falls
 *   back to the entity list rather than rendering a broken panel.
 *
 * Write access is `config.write` — read from the descriptor's
 * `permissions.write` for entity tabs, and pinned to `config.write` for the
 * Society tab (which is the key `config.update` is gated on in `Routes.gs`). */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardBody } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SocietySettingsForm } from '../components/SocietySettingsForm';
import { MasterEntityManager } from '../components/MasterEntityManager';
import { useEntityCatalog } from '../hooks/useSettings';
import { authStore } from '@/state/authStore';
import { hasPermission } from '@/lib/permission';
import type { ConfigEntity } from '@/types/domain';

/** Tab key for the non-entity society configuration panel. */
const SOCIETY_TAB = 'society';

/** `config.update` is gated on this key in Routes.gs:187. */
const CONFIG_WRITE = 'config.write';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { entityKey } = useParams<{ entityKey?: string }>();
  const { catalog, loading, error, reload } = useEntityCatalog();

  const permissions = useMemo(
    () => (Array.isArray(authStore.user?.permissions) ? authStore.user.permissions : []),
    [],
  );

  /* Entities the user may at least read. `config.entityMeta` requires
   * `config.read`, so reaching this page at all implies that — but a role can
   * hold `config.read` and still be unable to write, which is why each panel
   * also receives `canWrite`. */
  const visibleEntities = useMemo(
    () => catalog.filter((meta) => meta.fields.length > 0),
    [catalog],
  );

  const activeKey = entityKey ?? SOCIETY_TAB;
  const activeEntity: ConfigEntity | undefined = visibleEntities.find(
    (meta) => meta.entity === activeKey,
  );

  /* `Tabs` renders navigation and calls back with the selected key; the panel
   * itself is rendered by this component, below. */
  const tabs = useMemo(
    () => [
      { key: SOCIETY_TAB, label: 'Society', content: null },
      ...visibleEntities.map((meta) => ({
        key: meta.entity,
        label: meta.label,
        content: null,
      })),
    ],
    [visibleEntities],
  );

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="System configuration" />
        <Card>
          <CardBody>
            <p className="hs-text-sm hs-text-muted">Loading configuration…</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="System configuration" />
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Society configuration and master data"
        actions={
          <Badge variant="neutral">
            {visibleEntities.length} {visibleEntities.length === 1 ? 'entity' : 'entities'}
          </Badge>
        }
      />

      <Tabs
        tabs={tabs}
        selectedKey={activeKey}
        defaultKey={SOCIETY_TAB}
        onChange={(key) => {
          navigate(
            key === SOCIETY_TAB ? '/settings' : `/settings/entities/${key}`,
            { replace: false },
          );
        }}
      />

      <div className="hs-mt-5">
        {activeEntity ? (
          <MasterEntityManager
            key={activeEntity.entity}
            meta={activeEntity}
            catalog={catalog}
            canWrite={hasPermission(permissions, activeEntity.permissions.write)}
          />
        ) : activeKey === SOCIETY_TAB ? (
          <SocietySettingsForm canWrite={hasPermission(permissions, CONFIG_WRITE)} />
        ) : (
          <EmptyState
            title="Unknown configuration section"
            description={`There is no master entity named "${activeKey}". Pick one of the ${visibleEntities.length} available sections above.`}
          />
        )}
      </div>
    </div>
  );
}
