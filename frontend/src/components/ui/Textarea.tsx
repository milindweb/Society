/* Textarea.tsx — design.md §43 */

import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, hint, className = '', ...props }, ref) => {
    const classes = [
      'hs-input',
      'hs-textarea',
      error && 'hs-input--error',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <>
        <textarea ref={ref} className={classes} aria-invalid={!!error} {...props} />
        {error && <span className="hs-field__error">{error}</span>}
        {hint && !error && <span className="hs-field__hint">{hint}</span>}
      </>
    );
  },
);

Textarea.displayName = 'Textarea';
