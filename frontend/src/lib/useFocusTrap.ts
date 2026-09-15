/* useFocusTrap.ts — keyboard containment for Modal and Drawer (design.md §7).
 *
 * `design.md` §7 asks that focus be visible everywhere and that the only focus
 * traps be modals and drawers — which means those two *must* trap, and before
 * FE-15 neither did. Both set `aria-modal="true"`, so a screen reader already
 * treats the rest of the page as inert; without a trap a keyboard user could Tab
 * straight out of the dialog into content they cannot see.
 *
 * What this does:
 *   1. remembers the element that had focus before opening;
 *   2. moves focus to the container on open (not to the first control, so
 *      opening a dialog never accidentally activates a button);
 *   3. wraps Tab / Shift+Tab at the ends of the focusable list;
 *   4. restores focus to the original element on close.
 *
 * The listener is registered in the capture phase so it runs before any
 * descendant handler that might stop propagation. */

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap<T extends HTMLElement>(active: boolean): RefObject<T> {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    /* The container itself carries tabIndex={-1}, so this always succeeds. */
    container.focus({ preventScroll: true });

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        /* Nothing to move to — keep focus on the dialog rather than let it
           escape to the page behind. */
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || activeElement === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      /* Guard: the opener may have unmounted (e.g. a row action navigated away). */
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return containerRef;
}
