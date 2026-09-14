/* IconButton.tsx — design.md §88: icon-only button with accessible label */

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: ReactNode;
  label: string;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', icon, label, loading = false, className = '', ...props }, ref) => {
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
        aria-label={label}
        title={label}
        disabled={loading}
        {...props}
      >
        {icon}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
