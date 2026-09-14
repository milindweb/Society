/* AppSidebar.tsx — design.md §25–§28: compact icon-first sidebar */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Tooltip } from '../ui/Tooltip';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';

interface SidebarItem {
  key: string;
  label: string;
  icon: IconName;
  route: string;
  active?: boolean;
}

interface AppSidebarProps {
  items: SidebarItem[];
  activeRoute: string;
  onNavigate: (route: string) => void;
  collapsed?: boolean;
}

export function AppSidebar({ items, activeRoute, onNavigate, collapsed: controlledCollapsed }: AppSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const [locked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEnter = useCallback(() => {
    if (locked) return;
    clearTimeout(timerRef.current);
    setInternalCollapsed(false);
  }, [locked]);

  const handleLeave = useCallback(() => {
    if (locked) return;
    timerRef.current = setTimeout(() => setInternalCollapsed(true), 200);
  }, [locked]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const width = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w-expanded)';

  return (
    <aside
      className="hs-sidebar hs-no-print"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        width,
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width var(--motion-normal) var(--ease-standard)',
      }}
    >
      <div style={{ padding: 'var(--space-2)' }}>
        {items.map((item) => {
          const isActive = activeRoute === item.route || activeRoute.startsWith(item.route + '/');
          const content = (
            <button
              key={item.key}
              onClick={() => onNavigate(item.route)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--color-brand-soft)' : 'transparent',
                color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                whiteSpace: 'nowrap',
                transition: 'background var(--motion-fast), color var(--motion-fast)',
                textAlign: 'left',
              }}
            >
              <Icon name={item.icon} size={18} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.key} content={item.label}>
                {content}
              </Tooltip>
            );
          }

          return content;
        })}
      </div>
    </aside>
  );
}
