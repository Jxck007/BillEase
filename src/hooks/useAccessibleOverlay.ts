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

type OverlayEntry = {
  id: symbol;
  container: HTMLElement;
  onClose: () => void;
  closeOnEscape: boolean;
  restoreFocus: HTMLElement | null;
};

const overlayStack: OverlayEntry[] = [];
let bodyOverflow = '';
let bodyStates: SiblingState[] = [];

function applyOverlayStack() {
  const top = overlayStack.at(-1);
  if (!top) {
    document.body.style.overflow = bodyOverflow;
    for (const { element, inert, ariaHidden } of bodyStates) {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', ariaHidden);
    }
    bodyStates = [];
    return;
  }

  document.body.style.overflow = 'hidden';
  for (const { element } of bodyStates) {
    const active = element === top.container;
    element.inert = !active;
    if (active) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', 'true');
  }
  for (const entry of overlayStack) {
    const active = entry === top;
    entry.container.inert = !active;
    if (active) entry.container.removeAttribute('aria-hidden');
    else entry.container.setAttribute('aria-hidden', 'true');
  }
}

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

    const entry: OverlayEntry = {
      id: Symbol('overlay'),
      container,
      onClose,
      closeOnEscape,
      restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    if (!overlayStack.length) {
      bodyOverflow = document.body.style.overflow;
      bodyStates = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }));
    }
    overlayStack.push(entry);
    applyOverlayStack();

    const focusInitial = window.setTimeout(() => {
      const requested = initialFocusRef?.current
        || container.querySelector<HTMLElement>('[data-dialog-initial-focus], [autofocus]');
      const first = requested || container.querySelector<HTMLElement>(FOCUSABLE) || container;
      first.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (overlayStack.at(-1)?.id !== entry.id) return;
      if (event.key === 'Escape' && entry.closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        entry.onClose();
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
      const index = overlayStack.findIndex((item) => item.id === entry.id);
      if (index >= 0) overlayStack.splice(index, 1);
      applyOverlayStack();
      window.setTimeout(() => entry.restoreFocus?.focus({ preventScroll: true }), 0);
    };
  }, [closeOnEscape, containerRef, initialFocusRef, onClose, open]);
}
