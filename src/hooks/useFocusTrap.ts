import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Returns a ref to attach to a dialog/container. When the element mounts,
 * focus moves inside it, Tab/Shift+Tab cycle within it, and focus is
 * restored to the previously focused element on unmount. Escape is left
 * to callers.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>() {
  const nodeRef = useRef<T | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const ref = useCallback((node: T | null) => {
    nodeRef.current = node;
    if (node) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus({ preventScroll: true });
    } else {
      previousFocus.current?.focus({ preventScroll: true });
      previousFocus.current = null;
    }
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === node || !node.contains(active))) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        first.focus();
        e.preventDefault();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [ref]);

  return ref;
}
