import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { useLocale } from "../app/locale-context";
import { Icon, type IconName } from "./icons";

export function ControlDialog({
  title,
  subtitle,
  submitLabel,
  submitIcon,
  destructive = false,
  showCancel = true,
  submitDisabled = false,
  dialogClass = "",
  initialFocusSelector = "input:not([type='hidden']), .unified-select-trigger, textarea",
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  submitLabel: string;
  submitIcon?: IconName;
  destructive?: boolean;
  showCancel?: boolean;
  submitDisabled?: boolean;
  dialogClass?: string;
  initialFocusSelector?: string | null;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (formData: FormData) => void | Promise<void>;
}) {
  const { t } = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  closeRef.current = onClose;
  submittingRef.current = submitting;

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.documentElement.classList.add("overlay-open");
    document.body.classList.add("overlay-open");
    const timer = window.setTimeout(() => {
      const first = initialFocusSelector
        ? formRef.current?.querySelector<HTMLElement>(initialFocusSelector)
        : dialogRef.current;
      first?.focus();
    }, 20);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingRef.current) closeRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("overlay-open");
      document.body.classList.remove("overlay-open");
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [initialFocusSelector]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current?.reportValidity() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(new FormData(formRef.current));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : String(submitError),
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      id="control-dialog"
      className="dialog-backdrop control-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`control-dialog${dialogClass ? ` ${dialogClass}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="control-dialog-title"
        tabIndex={-1}
      >
        <form ref={formRef} onSubmit={(event) => void handleSubmit(event)}>
          <header>
            <div>
              <h2 id="control-dialog-title" title={t(title)}>
                {t(title)}
              </h2>
              {subtitle ? <p title={t(subtitle)}>{t(subtitle)}</p> : null}
            </div>
            <button
              className="icon-button"
              type="button"
              disabled={submitting}
              aria-label={t("关闭")}
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          </header>
          <div className="control-dialog-body">
            {error ? <div className="control-dialog-error">{error}</div> : null}
            {children}
          </div>
          <footer>
            {showCancel ? (
              <button
                className="button button-small"
                type="button"
                disabled={submitting}
                onClick={onClose}
              >
                {t("取消")}
              </button>
            ) : null}
            <button
              className={`button button-small ${destructive ? "button-danger" : "button-primary"}`}
              type="submit"
              disabled={submitting || submitDisabled}
            >
              {submitting ? (
                <>
                  <span className="spinner button-spinner" />
                  <span>{t("正在提交")}</span>
                </>
              ) : (
                <>
                  <Icon
                    name={submitIcon ?? (destructive ? "trash" : "check")}
                  />
                  <span>{t(submitLabel)}</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
