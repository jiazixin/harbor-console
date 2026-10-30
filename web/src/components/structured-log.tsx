import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { formatLogTimestamp } from "../lib/format/formatters";
import uiStyles0 from "./shared-ui.module.css";
import { type LogTimezone, parseHarborLogLine } from "./structured-log-support";
import uiStyles1 from "./structured-log.module.css";

const knownLevels = new Set([
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
]);

type StructuredLogProps = {
  value: string;
  timezone: LogTimezone;
  emptyMessage: string;
  ariaLabel?: string;
};

export function StructuredLog({
  value,
  timezone,
  emptyMessage,
  ariaLabel = "日志内容",
}: StructuredLogProps) {
  const { locale, t } = useLocale();
  const lines = (() => {
    const normalized = value.replace(/\r\n?/g, "\n").split("\n");
    if (normalized.at(-1) === "") normalized.pop();
    return normalized.map(parseHarborLogLine);
  })();
  if (!lines.length) {
    return (
      <div className={resolveClasses("structured-log-empty")}>
        {t(emptyMessage)}
      </div>
    );
  }
  return (
    <div
      className={resolveClasses("structured-log-view")}
      role="table"
      aria-label={t(ariaLabel)}
    >
      <div className={resolveClasses("structured-log-header")} role="row">
        <span role="columnheader">{t("时间")}</span>
        <span role="columnheader">{t("等级")}</span>
        <span role="columnheader">{t("日志内容")}</span>
      </div>
      {lines.map((line, index) => {
        const level = knownLevels.has(line.level) ? line.level : "LOG";
        return (
          <div
            className={resolveClasses(
              `structured-log-row log-level-${level.toLowerCase()}`,
            )}
            role="row"
            key={`${line.time}-${String(index)}`}
          >
            <time role="cell">
              {formatLogTimestamp(line.time, timezone, locale)}
            </time>
            <span
              className={resolveClasses("structured-log-level")}
              role="cell"
            >
              {level}
            </span>
            <span
              className={resolveClasses("structured-log-message")}
              role="cell"
            >
              {line.content || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const resolveClasses = createClassNames({
  "structured-log-empty": uiStyles0.structuredLogEmpty,
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
  "structured-log-view": uiStyles1.structuredLogView,
  "structured-log-header": uiStyles1.structuredLogHeader,
  "structured-log-row": uiStyles1.structuredLogRow,
  "structured-log-level": uiStyles1.structuredLogLevel,
  "structured-log-message": uiStyles1.structuredLogMessage,
});
