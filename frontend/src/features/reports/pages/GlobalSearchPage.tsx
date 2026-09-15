/* GlobalSearchPage.tsx — FE-12
 * `/search?q=...` — the full grouped results view.
 *
 * SRS §17. The quick dropdown in the header is capped at a few rows per group;
 * this page shows every hit the server returned, grouped by entity.
 *
 * Security note: `search.global` is `permission: null` (any authenticated user),
 * and the SERVER decides which groups are searchable based on the caller's own
 * permissions — a user without `complaints.read` simply never receives a
 * `complaints` group. So this page renders whatever groups arrive and does no
 * permission filtering of its own; doing so would duplicate the RBAC rules.
 *
 * Because groups are omitted when empty, "no results" and "no readable groups"
 * look identical from here, which is intentional: the backend should not reveal
 * which entities exist to a user who cannot read them. */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardBody } from '@/components/ui/Card';
import { useGlobalSearch } from '../hooks/useSearch';
import {
  presentGroups,
  primaryLabelFor,
  secondaryLabelFor,
  routeForHit,
  SEARCH_MIN_CHARS,
} from '@/services/searchService';
import type { SearchGroupKey } from '@/types/domain';

export default function GlobalSearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';

  /* The input is local so typing does not rewrite the URL on every keystroke;
   * Enter (or the button) commits the term to `?q=`. */
  const [term, setTerm] = useState(urlQuery);

  useEffect(() => {
    setTerm(urlQuery);
  }, [urlQuery]);

  const { groups, hitCount, loading, error, isSearchable, hasSearched, activeQuery } = useGlobalSearch({
    query: urlQuery,
  });

  const presented = presentGroups(groups);

  const submit = () => {
    const next = term.trim();
    if (next.length === 0) {
      setParams({}, { replace: true });
      return;
    }
    setParams({ q: next }, { replace: false });
  };

  return (
    <div>
      <PageHeader
        title="Search"
        subtitle={urlQuery ? `Results for “${urlQuery}”` : 'Search across flats, members, notices and records'}
        breadcrumbs={
          <nav aria-label="Breadcrumb">
            <Button variant="link" onClick={() => navigate('/dashboard')}>
              <Icon name="back" size={16} />
              Dashboard
            </Button>
          </nav>
        }
      />

      <Card>
        <CardBody>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                aria-label="Search term"
                placeholder="Flat number, member name, receipt, complaint…"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </div>
            <Button variant="primary" onClick={submit} disabled={term.trim().length === 0}>
              <Icon name="search" size={16} />
              Search
            </Button>
          </div>
          {term.trim().length > 0 && term.trim().length < SEARCH_MIN_CHARS && (
            <p
              style={{
                margin: 'var(--space-2) 0 0',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              Enter at least {SEARCH_MIN_CHARS} characters.
            </p>
          )}
        </CardBody>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      {!urlQuery && (
        <EmptyState
          title="Start typing to search"
          description={`Search returns flats, members, demands, payments, complaints, visitors and vendors — subject to what your role can read. Minimum ${SEARCH_MIN_CHARS} characters.`}
          icon={<Icon name="search" size={32} />}
        />
      )}

      {urlQuery && !isSearchable && (
        <Alert variant="info">
          “{urlQuery}” is shorter than the {SEARCH_MIN_CHARS}-character minimum, so no search was run.
        </Alert>
      )}

      {urlQuery && isSearchable && loading && (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton height={16} width="20%" />
                <div style={{ height: 'var(--space-3)' }} />
                <Skeleton height={14} width="100%" />
                <div style={{ height: 'var(--space-2)' }} />
                <Skeleton height={14} width="85%" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {urlQuery && isSearchable && !loading && error && <ErrorState message={error} />}

      {urlQuery && isSearchable && !loading && !error && hasSearched && hitCount === 0 && (
        <EmptyState
          title="No matches"
          description={`Nothing matched “${activeQuery || urlQuery}”. Try a partial flat number, a surname, or a receipt number.`}
          icon={<Icon name="search" size={32} />}
        />
      )}

      {urlQuery && isSearchable && !loading && !error && presented.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {presented.map((group) => (
            <SearchGroupCard
              key={group.key}
              groupKey={group.key}
              label={group.label}
              rows={group.rows}
              onNavigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchGroupCard({
  groupKey,
  label,
  rows,
  onNavigate,
}: {
  groupKey: SearchGroupKey;
  label: string;
  rows: Record<string, unknown>[];
  onNavigate: (path: string) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-text)',
            }}
          >
            {label}
          </h2>
          <Badge variant="neutral">{rows.length}</Badge>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {rows.map((row, index) => {
            const route = routeForHit(groupKey, row);
            const primary = primaryLabelFor(groupKey, row);
            const secondary = secondaryLabelFor(groupKey, row);
            const statusKey = row['statusKey'] ? String(row['statusKey']) : '';
            const key = `${groupKey}-${index}`;

            const body = (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text)',
                      fontWeight: 'var(--weight-medium)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {primary || '—'}
                  </span>
                  {secondary && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {secondary}
                    </span>
                  )}
                </span>
                {statusKey && <StatusBadge statusKey={statusKey} />}
              </span>
            );

            const itemStyle = {
              display: 'block',
              width: '100%',
              padding: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              font: 'inherit',
              cursor: route ? 'pointer' : 'default',
              textAlign: 'left',
            } as const;

            /* Vendors have no detail route in the router, so they render as a
             * plain row rather than a link to a route that does not exist. */
            if (!route) {
              return (
                <div key={key} style={itemStyle}>
                  {body}
                </div>
              );
            }

            return (
              <button key={key} type="button" style={itemStyle} onClick={() => onNavigate(route)}>
                {body}
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
