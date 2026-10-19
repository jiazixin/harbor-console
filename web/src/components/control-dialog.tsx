import { type FormEvent, type ReactNode, useRef, useState } from "react";

import { useLocale } from "../app/locale-context";
import { Icon, type IconName } from "./icons";
import { useModal } from "./use-modal";

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
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useModal({
    open: true,
    dialogRef,
    initialFocusSelector,
    onClose: () => {
      if (!submittingRef.current) onClose();
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !formRef.current?.reportValidity() ||
      submittingRef.current ||
      submitDisabled
    )
      return;
    submittingRef.current = true;
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
    } finally {
      submittingRef.current = false;
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
        aria-describedby={subtitle ? "control-dialog-description" : undefined}
        aria-busy={submitting}
        tabIndex={-1}
      >
        <form ref={formRef} onSubmit={(event) => void handleSubmit(event)}>
          <header className="control-dialog-header">
            <div>
              <h2
                id="control-dialog-title"
                className="control-dialog-title"
                title={t(title)}
              >
                {t(title)}
              </h2>
              {subtitle ? (
                <p id="control-dialog-description" title={t(subtitle)}>
                  {t(subtitle)}
                </p>
              ) : null}
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
            {error ? (
              <div className="notice notice-danger" role="alert">
                {t(error)}
              </div>
            ) : null}
            {children}
          </div>
          <footer className="control-dialog-footer">
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
