/* GlobalSearchBox.tsx — FE-12
 * The header search input. Feeds `AppHeader.searchSlot` (the layout already had
 * a slot reserved for it, so no layout change was needed).
 *
 * SRS §17: a single search entry point across the app.
 *
 * Behaviour:
 *  - Shows results in a dropdown for quick navigation, and offers "View all
 *    results" which deep-links to /search?q=... for the full grouped page.
 *  - Does not search below `SEARCH_MIN_CHARS`, because the backend validates the
 *    same minimum and would return VALIDATION_ERROR.
 *  - Closes on outside click and on Escape; arrow keys are not implemented, so
 *    the results are plain links that keep native keyboard behaviour. */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useGlobalSearch } from '../hooks/useSearch';
import {
  presentGroups,
  primaryLabelFor,
  secondaryLabelFor,
  routeForHit,
  SEARCH_MIN_CHARS,
} from '@/services/searchService';

export function GlobalSearchBox({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { groups, hitCount, loading, error, isSearchable, hasSearched } = useGlobalSearch({
    query,
  });

  const presented = presentGroups(groups);

  /* Close the dropdown on any click outside this component. */
  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const goToAll = () => {
    const q = query.trim();
    if (!isSearchable) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-subtle)',
            pointerEvents: 'none',
            display: 'flex',
          }}
        >
          <Icon name="search" size={16} />
        </span>
        <input
          type="search"
          className="hs-input"
          aria-label="Search flats, members, complaints and payments"
          placeholder="Search…"
          value={query}
          style={{ paddingLeft: '2.25rem' }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
            }
            if (e.key === 'Enter') goToAll();
          }}
        />
      </div>

      {showDropdown && (
        <div
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1))',
            left: 0,
            right: 0,
            zIndex: 40,
            maxHeight: '24rem',
            overflowY: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-2)',
          }}
        >
          {!isSearchable && (
            <p style={hintStyle}>Type at least {SEARCH_MIN_CHARS} characters to search.</p>
          )}

          {isSearchable && loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)' }}>
              <Spinner size="sm" />
              <span style={{ ...hintStyle, padding: 0 }}>Searching…</span>
            </div>
          )}

          {isSearchable && !loading && error && (
            <p style={{ ...hintStyle, color: 'var(--color-danger)' }}>{error}</p>
          )}

          {isSearchable && !loading && !error && hasSearched && hitCount === 0 && (
            <p style={hintStyle}>No matches for “{query.trim()}”.</p>
          )}

          {isSearchable && !loading && !error && presented.map((group) => (
            <div key={group.key} style={{ marginBottom: 'var(--space-2)' }}>
              <div
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {group.label}
              </div>
              {group.rows.slice(0, 4).map((row, index) => {
                const route = routeForHit(group.key, row);
                const primary = primaryLabelFor(group.key, row);
                const secondary = secondaryLabelFor(group.key, row);
                const key = `${group.key}-${index}`;

                if (!route) {
                  return (
                    <div key={key} style={rowStyle(false)}>
                      <ResultLabels primary={primary} secondary={secondary} />
                    </div>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    style={rowStyle(true)}
                    onClick={() => {
                      setOpen(false);
                      navigate(route);
                    }}
                  >
                    <ResultLabels primary={primary} secondary={secondary} />
                  </button>
                );
              })}
            </div>
          ))}

          {isSearchable && !loading && !error && hitCount > 0 && (
            <button type="button" style={viewAllStyle} onClick={goToAll}>
              View all {hitCount} result{hitCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultLabels({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', minWidth: 0 }}>
      <span
        style={{
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
  );
}

const hintStyle = {
  padding: 'var(--space-3)',
  margin: 0,
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-muted)',
} as const;

function rowStyle(clickable: boolean) {
  return {
    display: 'block',
    width: '100%',
    padding: 'var(--space-2)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: clickable ? 'pointer' : 'default',
    font: 'inherit',
  } as const;
}

const viewAllStyle = {
  display: 'block',
  width: '100%',
  marginTop: 'var(--space-1)',
  padding: 'var(--space-2)',
  border: 'none',
  borderTop: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-brand)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-medium)',
  cursor: 'pointer',
  textAlign: 'center',
} as const;
