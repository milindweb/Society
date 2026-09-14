/* Spinner.tsx — loading indicator */

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: '1rem', md: '1.25rem', lg: '2rem' };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      className={`hs-spinner ${className}`}
      style={{ width: SIZES[size], height: SIZES[size] }}
      role="status"
      aria-label="Loading"
    />
  );
}
