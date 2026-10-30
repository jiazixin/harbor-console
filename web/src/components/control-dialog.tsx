import { type ReactNode, type SubmitEvent, useRef, useState } from "react";
import { errorText } from "../app/errors";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles1 from "./control-dialog.module.css";
import { FormErrorsContext, formErrors } from "./form-errors";
import { Icon } from "./icon";
import { type IconName } from "./icons-support";
import uiStyles0 from "./shared-ui.module.css";
import { useModal } from "./use-modal";

type ControlDialogProps = {
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
};

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
}: ControlDialogProps) {
  const { t } = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>();

  useModal({
    open: true,
    dialogRef,
    initialFocusSelector,
    onClose: () => {
      if (!submittingRef.current) onClose();
    },
  });

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !formRef.current?.reportValidity() ||
      submittingRef.current ||
      submitDisabled
    )
      return;
    submittingRef.current = true;
    setError(undefined);
    setSubmitting(true);
    try {
      await onSubmit(new FormData(formRef.current));
    } catch (submitError) {
      setError(submitError);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div
      id="control-dialog"
      className={resolveClasses("dialog-backdrop control-dialog-backdrop")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={resolveClasses(
          `control-dialog${dialogClass ? ` ${dialogClass}` : ""}`,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="control-dialog-title"
        aria-describedby={subtitle ? "control-dialog-description" : undefined}
        aria-busy={submitting}
        tabIndex={-1}
      >
        <form ref={formRef} onSubmit={(event) => void handleSubmit(event)}>
          <header className={resolveClasses("control-dialog-header")}>
            <div>
              <h2
                id="control-dialog-title"
                className={resolveClasses("control-dialog-title")}
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
              className={resolveClasses("icon-button")}
              type="button"
              disabled={submitting}
              aria-label={t("关闭")}
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          </header>
          <div className={resolveClasses("control-dialog-body")}>
            {error !== undefined ? (
              <div
                className={resolveClasses("notice notice-danger")}
                role="alert"
              >
                {t(errorText(error))}
              </div>
            ) : null}
            <FormErrorsContext.Provider value={formErrors(error)}>
              {children}
            </FormErrorsContext.Provider>
          </div>
          <footer className={resolveClasses("control-dialog-footer")}>
            {showCancel ? (
              <button
                className={resolveClasses("button button-small")}
                type="button"
                disabled={submitting}
                onClick={onClose}
              >
                {t("取消")}
              </button>
            ) : null}
            <button
              className={resolveClasses(
                `button button-small ${destructive ? "button-danger" : "button-primary"}`,
              )}
              type="submit"
              disabled={submitting || submitDisabled}
            >
              {submitting ? (
                <>
                  <span className={resolveClasses("spinner button-spinner")} />
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

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "unified-select-trigger": uiStyles0.unifiedSelectTrigger,
  "control-dialog": uiStyles0.controlDialog,
  "dialog-backdrop": uiStyles0.dialogBackdrop,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
  "button-small": uiStyles0.buttonSmall,
  "button-danger": uiStyles0.buttonDanger,
  "button-primary": uiStyles0.buttonPrimary,
  spinner: uiStyles0.spinner,
  "button-spinner": uiStyles0.buttonSpinner,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
  "control-dialog-backdrop": uiStyles1.controlDialogBackdrop,
  "control-dialog-title": uiStyles1.controlDialogTitle,
  "control-dialog-header": uiStyles1.controlDialogHeader,
  "control-dialog-body": uiStyles1.controlDialogBody,
  "control-dialog-footer": uiStyles1.controlDialogFooter,
});
