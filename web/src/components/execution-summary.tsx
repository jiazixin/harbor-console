import type { ReactNode } from "react";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { formatDuration, formatNumber } from "../lib/format/formatters";
import uiStyles1 from "./execution-summary.module.css";
import uiStyles0 from "./shared-ui.module.css";
import { StatusBadge } from "./status-badge";

/** One counter of an execution, such as its failed tasks. */
type ExecutionStat = {
  label: string;
  value: number | undefined;
  tone?: "danger" | "success";
};

const toneClasses = { danger: "danger-text", success: "success-text" };

/** Harbor's explanation for an execution result, such as why a run failed. */
type ExecutionStatusMessageProps = {
  message?: string;
  status?: string;
};

function ExecutionStatusMessage({
  message,
  status,
}: ExecutionStatusMessageProps) {
  const text = message?.trim();
  if (!text) return null;
  return (
    <p
      className={resolveClasses("execution-status-text")}
      role={status?.toLowerCase() === "failed" ? "alert" : undefined}
    >
      {text}
    </p>
  );
}

/**
 * The header of an execution detail view: status, trigger details, task
 * counters, duration and Harbor's status message.
 */
type ExecutionSummaryProps = {
  status: string | undefined;
  /** Short facts shown after the status, such as the trigger and start time. */
  details: ReactNode[];
  stats: ExecutionStat[];
  startTime?: string;
  /** With a start time, adds the duration counter. */
  endTime?: string;
  statusMessage?: string;
  /** Shown before the status, such as a back button. */
  leading?: ReactNode;
  /** Shown at the end of the header, such as a stop button. */
  action?: ReactNode;
};

export function ExecutionSummary({
  status,
  details,
  stats,
  startTime,
  endTime,
  statusMessage,
  leading,
  action,
}: ExecutionSummaryProps) {
  const { locale, t } = useLocale();
  return (
    <section className={resolveClasses("execution-summary")}>
      <div className={resolveClasses("execution-summary-head")}>
        <div>
          {leading}
          <StatusBadge status={status} />
          {details.map((detail, index) => (
            <span key={index}>{detail}</span>
          ))}
        </div>
        {action}
      </div>
      <dl className={resolveClasses("execution-stats")}>
        {stats.map(({ label, value, tone }) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd
              className={resolveClasses(tone ? toneClasses[tone] : undefined)}
            >
              {formatNumber(value, locale)}
            </dd>
          </div>
        ))}
        {startTime !== undefined ? (
          <div>
            <dt>{t("耗时")}</dt>
            <dd>{formatDuration(startTime, endTime, locale)}</dd>
          </div>
        ) : null}
      </dl>
      <ExecutionStatusMessage message={statusMessage} status={status} />
    </section>
  );
}

const resolveClasses = createClassNames({
  "status-badge": uiStyles0.statusBadge,
  "danger-text": uiStyles0.dangerText,
  "success-text": uiStyles0.successText,
  "execution-summary": uiStyles0.executionSummary,
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
  "execution-status-text": uiStyles1.executionStatusText,
  "execution-summary-head": uiStyles1.executionSummaryHead,
  "execution-stats": uiStyles1.executionStats,
});
