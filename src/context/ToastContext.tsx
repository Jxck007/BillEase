import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const lastToast = useRef<{ message: string; at: number } | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const now = Date.now();
    if (lastToast.current?.message === message && now - lastToast.current.at < 2000) return;
    lastToast.current = { message, at: now };
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-[22rem]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info;
          const toneClass = toast.tone === 'success'
            ? 'border-emerald-200 text-emerald-800'
            : toast.tone === 'error'
              ? 'border-rose-200 text-rose-800'
              : 'border-blue-200 text-blue-800';
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex min-h-12 w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg ${toneClass}`}>
              <Icon size={20} className="shrink-0" />
              <span className="flex-1 text-sm font-semibold">{toast.message}</span>
              <button type="button" onClick={() => dismiss(toast.id)} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg hover:bg-stone-100" aria-label="Dismiss notification">
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
