/* Drawer.tsx — design.md §87: mobile sidebar overlay
 *
 * FE-15: the drawer set `aria-modal="true"` but never received focus, never
 * contained Tab and never restored focus — the mobile navigation could be opened
 * by keyboard and then not driven by it. `useFocusTrap` handles all three.
 *
 * The panel styles were also inline, which meant the `--space-*` / `--radius-*`
 * tokens could not be themed per breakpoint. They are unchanged in value; the
 * geometry now lives in `.hs-drawer` in `components.css` so media queries and
 * reduced-motion can reach it. */

import { type ReactNode, useEffect, useId, useRef, useCallback } from 'react';
import { IconButton } from './IconButton';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: 'left' | 'right';
}

export function Drawer({ open, onClose, title, children, side = 'left' }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const titleId = useId();

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
        className={`hs-drawer hs-drawer--${side}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Navigation'}
        tabIndex={-1}
      >
        <div className="hs-drawer__header">
          {title && <h2 className="hs-drawer__title" id={titleId}>{title}</h2>}
          <IconButton icon={<span>×</span>} label="Close" onClick={onClose} variant="ghost" size="sm" />
        </div>
        <div className="hs-drawer__body">{children}</div>
      </div>
    </div>
  );
}
