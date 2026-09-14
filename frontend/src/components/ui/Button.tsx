/* Button.tsx — design.md §4, §87–§88: variant | size | disabled | loading | className */

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, icon, children, className = '', disabled, ...props }, ref) => {
    const classes = [
      'hs-btn',
      `hs-btn--${variant}`,
      `hs-btn--${size}`,
      loading && 'hs-btn--loading',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {icon && !loading && <span className="hs-btn__icon">{icon}</span>}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
