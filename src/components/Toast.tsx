import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  undoAction?: () => void;
}

let toastId = 0;
let addToastFn: ((toast: Omit<Toast, "id">) => void) | null = null;

export function showToast(message: string, type: Toast["type"] = "info", undoAction?: () => void) {
  addToastFn?.({ message, type, undoAction });
}

export default function ToastContainer() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toastStyles: Record<string, { bg: string; border: string; text: string }> = {
    success: { bg: "var(--accent-soft)", border: "var(--success)", text: "var(--success)" },
    error: { bg: "var(--accent-soft)", border: "var(--danger)", text: "var(--danger)" },
    info: { bg: "var(--bg-elevated)", border: "var(--border-default)", text: "var(--text-primary)" },
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const s = toastStyles[toast.type] ?? toastStyles.info;
          return (
            <motion.div
              key={toast.id}
              role="alert"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
              style={{
                backgroundColor: s.bg,
                borderColor: s.border,
                color: s.text,
              }}
            >
              <span className="flex-1">{toast.message}</span>
              {toast.undoAction && (
                <button
                  onClick={() => {
                    toast.undoAction?.();
                    removeToast(toast.id);
                  }}
                  className="shrink-0 rounded-lg border px-2 py-1 text-xs transition-colors"
                  style={{
                    borderColor: "var(--border-default)",
                    backgroundColor: "var(--bg-inset)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t("toast.undo")}
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                aria-label={t("toast.dismissNotification")}
                className="shrink-0 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
