import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertTriangle, CheckCircle } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'alert';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (title: string, message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((title: string, message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none w-80">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-auto bg-[#1a1919]/90 backdrop-blur-xl p-4 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative"
            >
              {/* Colored Glow based on type */}
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none ${
                toast.type === 'alert' ? 'bg-[#ff716c]' : toast.type === 'success' ? 'bg-[#00e676]' : 'bg-[#8ff5ff]'
              }`} />

              <div className="flex gap-3 relative z-10">
                <div className="mt-0.5 flex-shrink-0">
                  {toast.type === 'info' && <Bell size={18} className="text-[#8ff5ff]" />}
                  {toast.type === 'alert' && <AlertTriangle size={18} className="text-[#ff716c]" />}
                  {toast.type === 'success' && <CheckCircle size={18} className="text-[#00e676]" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-white tracking-wide">{toast.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{toast.message}</p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-zinc-600 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
