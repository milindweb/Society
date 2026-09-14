/* Select.tsx — design.md §43, §46 */

import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, error, hint, className = '', ...props }, ref) => {
    const classes = [
      'hs-input',
      'hs-select',
      error && 'hs-input--error',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <>
        <select ref={ref} className={classes} aria-invalid={!!error} {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="hs-field__error">{error}</span>}
        {hint && !error && <span className="hs-field__hint">{hint}</span>}
      </>
    );
  },
);

Select.displayName = 'Select';
