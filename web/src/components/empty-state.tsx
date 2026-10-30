import type { ComponentProps } from "react";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { Icon } from "./icon";
import { type IconName } from "./icons-support";
import uiStyles0 from "./shared-ui.module.css";

export function EmptyState({
  title,
  description,
  icon,
  className = "",
  ...props
}: {
  title: string;
  description?: string;
  icon?: IconName;
} & ComponentProps<"div">) {
  const { t } = useLocale();
  return (
    <div
      className={resolveClasses(`empty-state ${className}`.trim())}
      {...props}
    >
      <div>
        {icon ? (
          <span className={resolveClasses("state-icon")} aria-hidden="true">
            <Icon name={icon} />
          </span>
        ) : null}
        <h2>{t(title)}</h2>
        {description ? <p>{t(description)}</p> : null}
      </div>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "empty-state": uiStyles0.emptyState,
  "state-icon": uiStyles0.stateIcon,
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
