import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { Icon } from "./icon";
import uiStyles0 from "./shared-ui.module.css";

export function DemoBanner() {
  const { t } = useLocale();
  return (
    <div className={resolveClasses("notice notice-info")}>
      <Icon name="alert" />
      <span>
        <strong>{t("当前为演示模式。")}</strong>{" "}
        {t("页面中的资产与状态为内置样例，连接真实实例后会自动替换。")}
      </span>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-info": uiStyles0.noticeInfo,
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
