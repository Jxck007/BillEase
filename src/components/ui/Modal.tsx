import { ReactNode, RefObject, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAccessibleOverlay } from '../../hooks/useAccessibleOverlay';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  description?: string;
  role?: 'dialog' | 'alertdialog';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeLabel?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  description,
  role = 'dialog',
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  closeLabel,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && (window.innerWidth < 1024 || window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    [],
  );

  useAccessibleOverlay({ open: isOpen, containerRef: overlayRef, onClose, closeOnEscape, initialFocusRef });

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div ref={overlayRef} className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6" data-billease-overlay>
          <motion.div 
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className="fixed inset-0 bg-black/40 md:backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div 
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} flex flex-col relative z-[101] max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden`}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl font-bold text-stone-800">{title}</h2>
                {description && <p id={descriptionId} className="mt-1 text-sm leading-5 text-stone-600">{description}</p>}
              </div>
              <button 
                type="button"
                onClick={onClose}
                aria-label={closeLabel || `Close ${title} dialog`}
                title={closeLabel || `Close ${title}`}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}
