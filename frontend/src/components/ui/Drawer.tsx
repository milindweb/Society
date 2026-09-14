/* Drawer.tsx — design.md §87: mobile sidebar overlay */

import { type ReactNode, useEffect, useRef, useCallback } from 'react';
import { IconButton } from './IconButton';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: 'left' | 'right';
}

export function Drawer({ open, onClose, title, children, side = 'left' }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="hs-modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="hs-drawer"
        style={{
          position: 'fixed',
          top: 0,
          [side]: 0,
          bottom: 0,
          width: '16rem',
          maxWidth: '85vw',
          background: 'var(--color-surface)',
          borderRight: side === 'left' ? '1px solid var(--color-border)' : undefined,
          borderLeft: side === 'right' ? '1px solid var(--color-border)' : undefined,
          zIndex: 'var(--z-drawer)',
          display: 'flex',
          flexDirection: 'column',
          animation: `hs-slide-${side} var(--motion-normal) var(--ease-standard)`,
        }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          {title && <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>{title}</h2>}
          <IconButton icon={<span>×</span>} label="Close" onClick={onClose} variant="ghost" size="sm" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
