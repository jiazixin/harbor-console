import { useCallback, useEffect, useState } from "react";

import { useLocale } from "../app/locale-context";

const toastDurationMs = 3600;

type ToastMessage = {
  id: number;
  message: string;
  error: boolean;
};

/** Holds the single visible toast and hides it after a short delay. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage>();
  const showToast = useCallback((message: string, error = false) => {
    setToast({ id: Date.now(), message, error });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return { toast, showToast };
}

export function ToastRegion({ toast }: { toast?: ToastMessage }) {
  const { t } = useLocale();
  return (
    <div
      id="toast-region"
      className="toast-region"
      aria-live="polite"
      aria-atomic="true"
    >
      {toast ? (
        <div
          key={toast.id}
          className={`toast${toast.error ? " toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {t(toast.message)}
        </div>
      ) : null}
    </div>
  );
}
