import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { fade, toast as toastMotion } from './motion';

interface ToastItem {
  id: number;
  message: string;
}

const ToastContext = createContext<((message: string) => void) | null>(null);

const DISMISS_MS = 3500;

/** הודעות קצרות ורכות. לא גונבות פוקוס; מוכרזות לקוראי מסך ב-aria-live="polite". */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const reduceMotion = useReducedMotion();

  const show = useCallback((message: string) => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-1), { id, message }]);
    window.setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), DISMISS_MS);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-height)+var(--safe-bottom)+84px)] z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 lg:bottom-8"
      >
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={reduceMotion ? fade : toastMotion}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-auto flex max-w-[var(--content-max)] items-center gap-2 rounded-full border border-border bg-surface-2 px-5 py-3 text-sm text-text shadow-2"
            >
              <Check aria-hidden size={18} className="shrink-0 text-d5" />
              {item.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast חייב לרוץ בתוך ToastProvider');
  return show;
}
