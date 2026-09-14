/* Skeleton.tsx — design.md §6: loading state placeholders */

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'title' | 'circle' | 'rect';
}

export function Skeleton({ className = '', width, height, variant = 'text' }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`hs-skeleton hs-skeleton--${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
