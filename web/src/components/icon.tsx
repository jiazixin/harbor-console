import type { SVGProps } from "react";
import { createClassNames } from "../lib/css/class-names";
import { type IconName } from "./icons-support";
import uiStyles0 from "./shared-ui.module.css";

export function Icon({
  name,
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      className={resolveClasses(`icon ${className}`.trim())}
      aria-hidden="true"
      {...props}
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
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
