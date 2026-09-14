/* Dropdown.tsx — design.md §87 */

import { type ReactNode, useState, useRef, useEffect, useCallback } from 'react';

interface DropdownItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div className="hs-dropdown" ref={ref}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {open && (
        <div className="hs-dropdown__menu" style={align === 'left' ? { right: 'auto', left: 0 } : undefined}>
          {items.map((item) =>
            item.key === 'divider' ? (
              <div key="divider" className="hs-dropdown__divider" />
            ) : (
              <button
                key={item.key}
                className="hs-dropdown__item"
                style={item.danger ? { color: 'var(--color-danger)' } : undefined}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
