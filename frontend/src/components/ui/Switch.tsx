/* Switch.tsx — design.md §46 */

import { type InputHTMLAttributes, forwardRef } from 'react';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className = '', ...props }, ref) => (
    <label className={`hs-switch ${className}`}>
      <input ref={ref} type="checkbox" role="switch" {...props} />
      <span className="hs-switch__track">
        <span className="hs-switch__thumb" />
      </span>
      {label && <span>{label}</span>}
    </label>
  ),
);

Switch.displayName = 'Switch';
