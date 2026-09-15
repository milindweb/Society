/* Dropdown.tsx — design.md §87
 *
 * FE-15 hardening: the trigger was `<div onClick>` — unreachable by keyboard and
 * invisible to assistive tech. It is now a real disclosure button:
 *   - `aria-haspopup` / `aria-expanded` / `aria-controls` expose the state;
 *   - ArrowDown opens the popup and focuses the first item;
 *   - ArrowUp/ArrowDown move between items, Escape closes and returns focus to
 *     the trigger, Tab out closes it.
 *
 * This is deliberately a *disclosure*, not `role="menu"`: the ARIA menu pattern
 * requires roving tabindex and full arrow-key semantics, and a half-implemented
 * menu is worse for screen readers than a labelled button plus a list of real
 * buttons. Items are ordinary `<button>`s, so Tab order and activation are
 * already correct. */

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

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
  /** Accessible name, required when the trigger is icon-only. */
  label?: string;
}

const ITEM_SELECTOR = '.hs-dropdown__item:not([disabled])';

export function Dropdown({ trigger, items, align = 'right', label }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  const focusItem = (position: 'first' | 'last') => {
    const itemsInMenu = menuRef.current?.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR);
    if (!itemsInMenu || itemsInMenu.length === 0) return;
    const index = position === 'first' ? 0 : itemsInMenu.length - 1;
    itemsInMenu[index]?.focus();
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      /* Enter/Space are handled by the button's own click; only the arrow needs
         explicit work, and only when the popup is still closed. */
      if (e.key !== 'ArrowDown' || open) return;
      e.preventDefault();
      setOpen(true);
      /* The popup mounts on the next frame; wait for it before focusing. */
      requestAnimationFrame(() => focusItem('first'));
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    e.preventDefault();
    const itemsInMenu = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR) ?? [],
    );
    if (itemsInMenu.length === 0) return;
    const current = itemsInMenu.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    const next = current === -1 ? 0 : (current + step + itemsInMenu.length) % itemsInMenu.length;
    itemsInMenu[next]?.focus();
  };

  return (
    <div className="hs-dropdown" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className="hs-dropdown__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleTriggerKeyDown}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className="hs-dropdown__menu"
          style={align === 'left' ? { right: 'auto', left: 0 } : undefined}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) =>
            item.key === 'divider' ? (
              <div key="divider" className="hs-dropdown__divider" role="separator" />
            ) : (
              <button
                type="button"
                key={item.key}
                className="hs-dropdown__item"
                style={item.danger ? { color: 'var(--color-danger)' } : undefined}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  close(true);
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
