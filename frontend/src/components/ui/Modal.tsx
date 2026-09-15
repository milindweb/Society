/* Modal.tsx — design.md §87: overlay + dialog
 *
 * FE-15: focus management was missing. The dialog announced itself as
 * `aria-modal` but never received focus, never contained Tab, and never returned
 * focus on close. `useFocusTrap` now does all three, and `aria-labelledby` ties
 * the dialog to its visible title instead of duplicating it in `aria-label`. */

import { type ReactNode, useEffect, useId, useRef, useCallback } from 'react';
import { IconButton } from './IconButton';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, className = '' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
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
        className={`hs-modal ${className}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="hs-modal__header">
          <h2 className="hs-modal__title" id={titleId}>{title}</h2>
          <IconButton icon={<span>×</span>} label="Close" onClick={onClose} variant="ghost" size="sm" />
        </div>
        <div className="hs-modal__body">{children}</div>
        {footer && <div className="hs-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
