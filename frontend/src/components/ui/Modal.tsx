/* Modal.tsx — design.md §87: overlay + dialog */

import { type ReactNode, useEffect, useRef, useCallback } from 'react';
import { IconButton } from './IconButton';

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
      <div className={`hs-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="hs-modal__header">
          <h2 className="hs-modal__title">{title}</h2>
          <IconButton icon={<span>×</span>} label="Close" onClick={onClose} variant="ghost" size="sm" />
        </div>
        <div className="hs-modal__body">{children}</div>
        {footer && <div className="hs-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
