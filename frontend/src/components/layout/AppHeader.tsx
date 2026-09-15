/* AppHeader.tsx — design.md §24, §87 */

import { type ReactNode } from 'react';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { Dropdown } from '../ui/Dropdown';

interface AppHeaderProps {
  onMenuToggle?: () => void;
  userName?: string;
  userAvatar?: string;
  /** Configured society name. Never a literal: SRS §15 / frontend-architecture.md §8. */
  societyName?: string;
  onLogout?: () => void;
  /** Opens the self-service password change screen (`/auth/change-password`). */
  onChangePassword?: () => void;
  searchSlot?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({
  onMenuToggle,
  userName,
  userAvatar,
  societyName,
  onLogout,
  onChangePassword,
  searchSlot,
  actions,
}: AppHeaderProps) {
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
      {/* Brand mark. The crest is always shown — it is the app's identity even
          before config resolves — while the name only appears once the
          configured society name has loaded (SRS §15). Grouped so the two
          truncate together instead of competing for header width. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
        <Logo size={28} />
        {societyName && (
          <span
            className="hs-header__brand"
            style={{
              fontWeight: 'var(--weight-bold)',
              fontSize: 'var(--text-lg)',
              color: 'var(--color-brand)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {societyName}
          </span>
        )}
      </span>
      {searchSlot && <div style={{ flex: 1, maxWidth: '24rem' }}>{searchSlot}</div>}
      <div style={{ flex: 1 }} />
      {actions}
      {userName && (
        <Dropdown
          label={userName}
          trigger={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Avatar name={userName} src={userAvatar} size="sm" />
              <span className="hs-sm-hidden" style={{ fontSize: 'var(--text-sm)' }}>{userName}</span>
            </span>
          }
          items={[
            /* Was an inert "Profile" item with no handler — a menu entry that
             * does nothing. There is no profile screen, so it now opens the
             * password change page, which is the only self-service account
             * action the app has. */
            {
              key: 'change-password',
              label: 'Change password',
              icon: <Icon name="lock" size={16} />,
              onClick: onChangePassword ?? (() => {}),
            },
            { key: 'divider', label: '', onClick: () => {} },
            { key: 'logout', label: 'Logout', icon: <Icon name="logout" size={16} />, onClick: onLogout ?? (() => {}) },
          ]}
        />
      )}
    </header>
  );
}
