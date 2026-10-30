import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

/** Title of a panel's toolbar, optionally followed by a muted count. */
type PanelTitleProps = {
  title: string;
  count?: string;
};

export function PanelTitle({ title, count }: PanelTitleProps) {
  const { t } = useLocale();
  return (
    <div className={resolveClasses("panel-title")}>
      <strong>{t(title)}</strong>
      {count ? (
        <span className={resolveClasses("section-count")}>{count}</span>
      ) : null}
    </div>
  );
}

const resolveClasses = createClassNames({
  "panel-title": uiStyles0.panelTitle,
  "section-count": uiStyles0.sectionCount,
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
