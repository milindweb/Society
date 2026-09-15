/* FormField.tsx — design.md §44: Label → Input → Hint/Error */

import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, error, hint, children, className = '' }: FormFieldProps) {
  const generatedId = useId();
  /* When the caller supplies an id on the child, that id wins — the input keeps
   * it and `<label for>` must point at the SAME value. Using `generatedId` for
   * `htmlFor` unconditionally silently broke the association for every field
   * that passed an explicit id (settings, users, roles, change-password),
   * leaving the control with no accessible name. */
  const childId = isValidElement(children) ? (children.props as { id?: string }).id : undefined;
  const id = childId || generatedId;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;

  return (
    <div className={`hs-field ${className}`}>
      <label htmlFor={id} className="hs-field__label">
        {label}
        {required && <span className="hs-text-danger"> *</span>}
      </label>
      <div>{control}</div>
      {error && <span className="hs-field__error">{error}</span>}
      {hint && !error && <span className="hs-field__hint">{hint}</span>}
    </div>
  );
}
