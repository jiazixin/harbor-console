import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

type LoadingViewProps = { title?: string; description?: string };

export function LoadingView({
  title = "正在读取 Harbor 实例",
  description = "正在聚合项目、复制任务与系统状态...",
}: LoadingViewProps = {}) {
  const { t } = useLocale();
  return (
    <div className={resolveClasses("loading-state")} role="status">
      <div>
        <span className={resolveClasses("spinner")} aria-hidden="true" />
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
      </div>
    </div>
  );
}

const resolveClasses = createClassNames({
  "loading-state": uiStyles0.loadingState,
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
