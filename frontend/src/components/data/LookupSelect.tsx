/* LookupSelect.tsx — config-driven dropdown for entity lookups */

import { useState } from 'react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';

interface LookupSelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
  /** When provided, renders a search box above the select that calls back with
   * the typed term so the owning hook can re-query the API (SRS §3.4). */
  onSearch?: (term: string) => void;
  searchPlaceholder?: string;
}

export function LookupSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  loading = false,
  error,
  className = '',
  disabled = false,
  onSearch,
  searchPlaceholder = 'Type to search...',
}: LookupSelectProps) {
  const [term, setTerm] = useState('');

  const select = (
    <Select
      options={[{ value: '', label: placeholder, disabled: true }, ...options]}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      error={error}
      className={className}
      disabled={disabled || loading}
    />
  );

  if (loading && options.length === 0) {
    return (
      <div
        className={`hs-input ${className}`}
        style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}
      >
        Loading...
      </div>
    );
  }

  if (!onSearch) return select;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <Input
        value={term}
        placeholder={searchPlaceholder}
        disabled={disabled}
        aria-label={searchPlaceholder}
        onChange={(e) => {
          setTerm(e.target.value);
          onSearch(e.target.value);
        }}
      />
      {select}
      {loading && (
        <span className="hs-field__hint" style={{ fontSize: 'var(--text-xs)' }}>
          Searching...
        </span>
      )}
    </div>
  );
}
