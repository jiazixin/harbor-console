import { useMemo } from "react";

import { useLocale } from "../app/locale-context";

export type LogTimezone = "local" | "utc";

type ParsedLogLine = {
  time: string;
  level: string;
  content: string;
};

const knownLevels = new Set([
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
]);

export function parseHarborLogLine(value: string): ParsedLogLine {
  const match =
    /^(\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?)\s+\[?(TRACE|DEBUG|INFO|WARNING|WARN|ERROR|FATAL)\]?\s*(.*)$/i.exec(
      value,
    );
  if (!match) return { time: "", level: "LOG", content: value };
  return {
    time: match[1],
    level:
      match[2].toUpperCase() === "WARNING" ? "WARN" : match[2].toUpperCase(),
    content: match[3],
  };
}

function displayLogTime(
  value: string,
  timezone: LogTimezone,
  locale: "zh-CN" | "en-US",
): string {
  if (!value || timezone === "utc") return value || "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replaceAll("/", "-");
}

export function LogTimezoneControl({
  value,
  onChange,
}: {
  value: LogTimezone;
  onChange: (value: LogTimezone) => void;
}) {
  const { t } = useLocale();
  return (
    <div
      className="log-timezone-control"
      role="group"
      aria-label={t("日志时区")}
    >
      {(["local", "utc"] as const).map((timezone) => (
        <button
          key={timezone}
          type="button"
          className={value === timezone ? "active" : ""}
          aria-pressed={value === timezone}
          onClick={() => onChange(timezone)}
        >
          {timezone === "local" ? t("本地") : "UTC"}
        </button>
      ))}
    </div>
  );
}

export function StructuredLog({
  value,
  timezone,
  emptyMessage,
  ariaLabel = "日志内容",
}: {
  value: string;
  timezone: LogTimezone;
  emptyMessage: string;
  ariaLabel?: string;
}) {
  const { locale, t } = useLocale();
  const lines = useMemo(() => {
    const normalized = value.replace(/\r\n?/g, "\n").split("\n");
    if (normalized.at(-1) === "") normalized.pop();
    return normalized.map(parseHarborLogLine);
  }, [value]);
  if (!lines.length) {
    return <div className="structured-log-empty">{t(emptyMessage)}</div>;
  }
  return (
    <div className="structured-log-view" role="table" aria-label={t(ariaLabel)}>
      <div className="structured-log-header" role="row">
        <span role="columnheader">{t("时间")}</span>
        <span role="columnheader">{t("等级")}</span>
        <span role="columnheader">{t("日志内容")}</span>
      </div>
      {lines.map((line, index) => {
        const level = knownLevels.has(line.level) ? line.level : "LOG";
        return (
          <div
            className={`structured-log-row log-level-${level.toLowerCase()}`}
            role="row"
            key={`${line.time}-${String(index)}`}
          >
            <time role="cell">
              {displayLogTime(line.time, timezone, locale)}
            </time>
            <span className="structured-log-level" role="cell">
              {level}
            </span>
            <span className="structured-log-message" role="cell">
              {line.content || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}
