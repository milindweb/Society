/* Radio.tsx — design.md §46 */

import { type InputHTMLAttributes, forwardRef } from 'react';

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className = '', ...props }, ref) => (
    <label className={`hs-radio ${className}`}>
      <input ref={ref} type="radio" {...props} />
      <span>{label}</span>
    </label>
  ),
);

Radio.displayName = 'Radio';
