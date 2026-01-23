import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";

type ToastKind = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ToastContextValue = {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
};

const ToastContext = createContext<ToastContextValue | null>(null);

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timersRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const pushToast = useCallback(
    (message: string, kind: ToastKind) => {
      const id = createId();
      setItems((current) => [...current, { id, message, kind }]);
      timersRef.current[id] = window.setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: {
        success: (message) => pushToast(message, "success"),
        error: (message) => pushToast(message, "error")
      }
    }),
    [pushToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed left-1/2 top-4 z-[60] flex w-[280px] -translate-x-1/2 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`pk-toast pointer-events-auto rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur ${
              item.kind === "success"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border-red-400/40 bg-red-500/15 text-red-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="leading-relaxed">{item.message}</span>
              <button
                className="text-white/70"
                onClick={() => removeToast(item.id)}
                aria-label="Закрыть"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
};

export default ToastProvider;
