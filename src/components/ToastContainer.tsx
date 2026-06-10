import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { TOAST_EVENT, type ToastItem } from '../utils/toast';

const DURATION = 4000;

const CONFIG = {
  success: {
    bg: 'bg-emerald-500',
    icon: <CheckCircle size={16} className="shrink-0" />,
  },
  error: {
    bg: 'bg-red-500',
    icon: <XCircle size={16} className="shrink-0" />,
  },
  warning: {
    bg: 'bg-amber-500',
    icon: <AlertTriangle size={16} className="shrink-0" />,
  },
  info: {
    bg: 'bg-blue-500',
    icon: <Info size={16} className="shrink-0" />,
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const item = (e as CustomEvent<ToastItem>).detail;
      setToasts(prev => [...prev, item]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id));
      }, DURATION);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[320px] w-full">
      <AnimatePresence>
        {toasts.map(t => {
          const cfg = CONFIG[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold ${cfg.bg}`}
            >
              {cfg.icon}
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
}
