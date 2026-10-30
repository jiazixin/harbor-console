import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ToastMessage = { id: string; message: string; isError: boolean };
type ToastValue = {
  toast?: ToastMessage;
  showToast: (message: string, isError?: boolean) => void;
};
const ToastContext = createContext<ToastValue | null>(null);
const toastDurationMs = 3600;
type ToastProviderProps = { children: ReactNode };

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastMessage>();
  const showToast = useCallback((message: string, isError = false) => {
    setToast({ id: crypto.randomUUID(), message, isError });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(undefined);
    }, toastDurationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);
  return <ToastContext value={{ toast, showToast }}>{children}</ToastContext>;
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}
