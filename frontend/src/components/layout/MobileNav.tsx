/* MobileNav.tsx — design.md §29: mobile bottom navigation */

import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';

interface MobileNavItem {
  key: string;
  label: string;
  icon: IconName;
  route: string;
}

interface MobileNavProps {
  items: MobileNavItem[];
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function MobileNav({ items, activeRoute, onNavigate }: MobileNavProps) {
  return (
    <nav
      className="hs-mobile-nav hs-no-print"
      style={{
        display: 'none',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 'var(--z-sticky)',
        padding: 'var(--space-1) 0',
        justifyContent: 'space-around',
      }}
    >
      {items.slice(0, 5).map((item) => {
        const isActive = activeRoute === item.route;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.route)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: 'var(--space-1)',
              border: 'none',
              background: 'none',
              color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
            }}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
