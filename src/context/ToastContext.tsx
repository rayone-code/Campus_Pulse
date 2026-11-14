import { createContext, useCallback, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, { box: string; Icon: typeof Info }> = {
  success: {
    box: "border-emerald-200 bg-white text-slate-900",
    Icon: CheckCircle2,
  },
  error: {
    box: "border-rose-200 bg-white text-slate-900",
    Icon: AlertCircle,
  },
  info: {
    box: "border-slate-200 bg-white text-slate-900",
    Icon: Info,
  },
};

const ICON_COLOR: Record<ToastType, string> = {
  success: "text-emerald-600",
  error: "text-rose-600",
  info: "text-blue-700",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", durationMs = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map(({ id, message, type }) => {
          const { box, Icon } = TOAST_STYLES[type];
          return (
            <div
              key={id}
              className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-lg ${box}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[type]}`} />
              <p className="flex-1 text-sm font-medium">{message}</p>
              <button
                type="button"
                onClick={() => removeToast(id)}
                className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
