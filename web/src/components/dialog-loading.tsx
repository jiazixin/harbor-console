import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

/** The loading state inside a dialog body. */
type DialogLoadingProps = { message: string };

export function DialogLoading({ message }: DialogLoadingProps) {
  const { t } = useLocale();
  return (
    <div className={resolveClasses("dialog-loading")} role="status">
      <span className={resolveClasses("spinner")} />
      <span>{t(message)}</span>
    </div>
  );
}

const resolveClasses = createClassNames({
  "dialog-loading": uiStyles0.dialogLoading,
  spinner: uiStyles0.spinner,
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
});
