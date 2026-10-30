import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";
import { type LogTimezone } from "./structured-log-support";

type LogTimezoneControlProps = {
  value: LogTimezone;
  onChange: (value: LogTimezone) => void;
};

export function LogTimezoneControl({
  value,
  onChange,
}: LogTimezoneControlProps) {
  const { t } = useLocale();
  return (
    <div
      className={resolveClasses("log-timezone-control")}
      role="group"
      aria-label={t("日志时区")}
    >
      {(["local", "utc"] as const).map((timezone) => (
        <button
          key={timezone}
          type="button"
          className={resolveClasses(value === timezone ? "active" : "")}
          aria-pressed={value === timezone}
          onClick={() => {
            onChange(timezone);
          }}
        >
          {timezone === "local" ? t("本地") : "UTC"}
        </button>
      ))}
    </div>
  );
}

const resolveClasses = createClassNames({
  "log-timezone-control": uiStyles0.logTimezoneControl,
  button: uiStyles0.button,
  active: uiStyles0.active,
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
