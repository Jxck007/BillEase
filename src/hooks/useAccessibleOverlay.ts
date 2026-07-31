import { RefObject, useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Options = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

type SiblingState = {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
};

export function useAccessibleOverlay({
  open,
  containerRef,
  onClose,
  closeOnEscape = true,
  initialFocusRef,
}: Options) {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const siblings: SiblingState[] = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== container)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }));

    for (const { element } of siblings) {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = 'hidden';

    const focusInitial = window.setTimeout(() => {
      const requested = initialFocusRef?.current
        || container.querySelector<HTMLElement>('[data-dialog-initial-focus], [autofocus]');
      const first = requested || container.querySelector<HTMLElement>(FOCUSABLE) || container;
      first.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      for (const { element, inert, ariaHidden } of siblings) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
      window.setTimeout(() => previouslyFocused?.focus({ preventScroll: true }), 0);
    };
  }, [closeOnEscape, containerRef, initialFocusRef, onClose, open]);
}

