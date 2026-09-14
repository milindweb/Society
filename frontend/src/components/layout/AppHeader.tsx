/* AppHeader.tsx — design.md §24, §87 */

import { type ReactNode } from 'react';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { Dropdown } from '../ui/Dropdown';

interface AppHeaderProps {
  onMenuToggle?: () => void;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
  searchSlot?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ onMenuToggle, userName, userAvatar, onLogout, searchSlot, actions }: AppHeaderProps) {
  return (
    <header
      className="hs-header hs-no-print"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 'var(--header-h)',
        padding: '0 var(--space-4)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        gap: 'var(--space-3)',
      }}
    >
      {onMenuToggle && (
        <IconButton
          icon={<Icon name="menu" />}
          label="Toggle menu"
          onClick={onMenuToggle}
          variant="ghost"
          size="sm"
        />
      )}
      <span
        style={{
          fontWeight: 'var(--weight-bold)',
          fontSize: 'var(--text-lg)',
          color: 'var(--color-brand)',
          whiteSpace: 'nowrap',
        }}
      >
        Society
      </span>
      {searchSlot && <div style={{ flex: 1, maxWidth: '24rem' }}>{searchSlot}</div>}
      <div style={{ flex: 1 }} />
      {actions}
      {userName && (
        <Dropdown
          trigger={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <Avatar name={userName} src={userAvatar} size="sm" />
              <span className="hs-sm-hidden" style={{ fontSize: 'var(--text-sm)' }}>{userName}</span>
            </div>
          }
          items={[
            { key: 'profile', label: 'Profile', icon: <Icon name="user" size={16} /> },
            { key: 'divider', label: '', onClick: () => {} },
            { key: 'logout', label: 'Logout', icon: <Icon name="logout" size={16} />, onClick: onLogout ?? (() => {}) },
          ]}
        />
      )}
    </header>
  );
}
