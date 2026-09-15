/* MobileNav.tsx — design.md §29: mobile bottom navigation
 *
 * FE-15: the root element carried an inline `display: none` with no media query
 * that could ever override it, so the component could not render even if it were
 * mounted — an inline style beats a stylesheet rule. Visibility now lives in
 * `.hs-mobile-nav` (components.css), where the mobile breakpoint can reach it.
 *
 * NOTE: nothing mounts this component yet. `AppLayout` uses the sidebar/drawer
 * pair instead, which is why the bottom bar is not part of the running UI.
 * Wiring it in is a design decision, not a hardening fix, and is recorded as an
 * open item in the FE-15 phase notes. */

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
    <nav className="hs-mobile-nav hs-no-print" aria-label="Primary">
      {items.slice(0, 5).map((item) => {
        const isActive = activeRoute === item.route;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.route)}
            aria-current={isActive ? 'page' : undefined}
            className="hs-mobile-nav__item"
            style={{
              color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
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
