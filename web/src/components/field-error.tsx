import { createClassNames } from "../lib/css/class-names";
import styles from "./field-error.module.css";
import uiStyles0 from "./shared-ui.module.css";

type FieldErrorProps = { id: string; message: string | undefined };

export function FieldError({ id, message }: FieldErrorProps) {
  return message ? (
    <span id={id} className={resolveClasses(styles.message)}>
      {message}
    </span>
  ) : null;
}

const resolveClasses = createClassNames({
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
