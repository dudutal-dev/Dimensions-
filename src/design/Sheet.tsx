import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { fade, sheetPanel } from './motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])';

/**
 * Sheet תחתון (SPEC 4.6): נפתח מלמטה, נסגר בהחלקה מטה, ב-Escape, בלחיצה על הרקע או בכפתור הסגירה.
 * ה-blur כאן מסמן שכבה — זה אחד משני המקומות היחידים שבהם מותר glass (השני: הניווט).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      // מלכודת פוקוס: Tab נשאר בתוך ה-sheet.
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-sheet)] flex items-end justify-center">
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            variants={reduceMotion ? fade : sheetPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className="relative flex max-h-[88dvh] w-full max-w-[var(--content-max)] flex-col rounded-t-sheet border border-b-0 border-border bg-surface shadow-3 outline-none"
          >
            <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-border-strong/60" />
            <header className="flex items-center justify-between gap-2 ps-6 pe-3 pt-1">
              <h2 id={titleId} className="text-lg">
                {title}
              </h2>
              <IconButton label="סגירה" onClick={onClose}>
                <X aria-hidden size={22} />
              </IconButton>
            </header>
            <div className="overflow-y-auto overscroll-contain px-6 pt-2 pb-[calc(var(--safe-bottom)+24px)]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
