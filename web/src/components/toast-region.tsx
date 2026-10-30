import { useLocale } from "../app/locale-context";
import type { ToastMessage } from "../app/toast-provider";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";
import uiStyles1 from "./toast-region.module.css";

type ToastRegionProps = { toast?: ToastMessage };

export function ToastRegion({ toast }: ToastRegionProps) {
  const { t } = useLocale();
  return (
    <div
      id="toast-region"
      className={resolveClasses("toast-region")}
      aria-live="polite"
      aria-atomic="true"
    >
      {toast ? (
        <div
          key={toast.id}
          className={resolveClasses(
            `toast${toast.isError ? " toast-error" : ""}`,
          )}
          role={toast.isError ? "alert" : "status"}
        >
          {t(toast.message)}
        </div>
      ) : null}
    </div>
  );
}

const resolveClasses = createClassNames({
  "toast-region": uiStyles0.toastRegion,
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
  toast: uiStyles1.toast,
  "toast-error": uiStyles1.toastError,
});
