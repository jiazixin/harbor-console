import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { Icon } from "./icon";
import uiStyles0 from "./shared-ui.module.css";

type RefreshButtonProps = {
  refreshing: boolean;
  onRefresh: () => void;
};

export function RefreshButton({ refreshing, onRefresh }: RefreshButtonProps) {
  const { t } = useLocale();
  return (
    <button
      className={resolveClasses("button button-small refresh-button")}
      type="button"
      aria-busy={refreshing}
      disabled={refreshing}
      onClick={onRefresh}
    >
      <Icon name="refresh" />
      <span>{t("刷新")}</span>
    </button>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "refresh-button": uiStyles0.refreshButton,
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
