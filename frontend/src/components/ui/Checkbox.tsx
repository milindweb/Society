/* Checkbox.tsx — design.md §46 */

import { type InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', ...props }, ref) => (
    <label className={`hs-checkbox ${className}`}>
      <input ref={ref} type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  ),
);

Checkbox.displayName = 'Checkbox';
