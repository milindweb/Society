/* Input.tsx — design.md §43, §88 */

import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, hint, className = '', ...props }, ref) => {
    const classes = [
      'hs-input',
      error && 'hs-input--error',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <>
        <input ref={ref} className={classes} aria-invalid={!!error} {...props} />
        {error && <span className="hs-field__error">{error}</span>}
        {hint && !error && <span className="hs-field__hint">{hint}</span>}
      </>
    );
  },
);

Input.displayName = 'Input';
