/* LookupSelect.tsx — config-driven dropdown for entity lookups */

import { Select } from '../ui/Select';

interface LookupSelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
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
}: LookupSelectProps) {
  if (loading) {
    return (
      <div className={`hs-input ${className}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <Select
      options={[{ value: '', label: placeholder, disabled: true }, ...options]}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      error={error}
      className={className}
      disabled={disabled}
    />
  );
}
