/* Avatar.tsx — design.md §87 */

import { getInitials } from '@/lib/format';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`hs-avatar hs-avatar--${size} ${className}`}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <span className={`hs-avatar hs-avatar--${size} ${className}`} title={name}>
      {getInitials(name)}
    </span>
  );
}
