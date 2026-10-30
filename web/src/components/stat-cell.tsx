import { type ReactNode } from "react";
import { createClassNames } from "../lib/css/class-names";
import { Icon } from "./icon";
import { type IconName } from "./icons-support";
import uiStyles0 from "./shared-ui.module.css";
import uiStyles1 from "./stat-cell.module.css";

type StatCellProps = {
  label: ReactNode;
  value: ReactNode;
  foot: ReactNode;
  icon: IconName;
};

export function StatCell({ label, value, foot, icon }: StatCellProps) {
  return (
    <div className={resolveClasses("stat-cell")}>
      <span className={resolveClasses("stat-label")}>
        <span>{label}</span>
        <Icon name={icon} />
      </span>
      <strong className={resolveClasses("stat-value")}>{value}</strong>
      <span className={resolveClasses("stat-foot")}>{foot}</span>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "stat-cell": uiStyles0.statCell,
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
  "stat-label": uiStyles1.statLabel,
  "stat-value": uiStyles1.statValue,
  "stat-foot": uiStyles1.statFoot,
});
