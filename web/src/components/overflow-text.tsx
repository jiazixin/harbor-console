import type { HTMLAttributes } from "react";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

type OverflowTextProps = HTMLAttributes<HTMLElement> & {
  as?: "code" | "small" | "span" | "strong";
  children: string;
};

export function OverflowText({
  as,
  children,
  className = "",
  ...props
}: OverflowTextProps) {
  const Component = as ?? "span";
  return (
    <Component
      className={resolveClasses(
        `overflow-text${className ? ` ${className}` : ""}`,
      )}
      title={children}
      {...props}
    >
      {children}
    </Component>
  );
}

const resolveClasses = createClassNames({
  "overflow-text": uiStyles0.overflowText,
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
