import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";
import { severityPresentations } from "./status-badge-support";

type SeverityBadgeProps = { severity: string | undefined };

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const { t } = useLocale();
  const presentation = severityPresentations[
    severity?.toLowerCase() ?? "unknown"
  ] ?? {
    label: severity?.trim() ? severity : "未扫描",
    className: "",
  };
  return (
    <span className={resolveClasses(`badge ${presentation.className}`.trim())}>
      {t(presentation.label)}
    </span>
  );
}

const resolveClasses = createClassNames({
  badge: uiStyles0.badge,
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
