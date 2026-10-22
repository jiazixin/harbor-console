import type { ReactNode } from "react";

import { formatDuration, formatNumber } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import { StatusBadge } from "./status-badge";

/** One counter of an execution, such as its failed tasks. */
type ExecutionStat = {
  label: string;
  value: number | undefined;
  tone?: "danger" | "success";
};

const toneClasses = { danger: "danger-text", success: "success-text" };

/** Harbor's explanation for an execution result, such as why a run failed. */
function ExecutionStatusMessage({
  message,
  status,
}: {
  message?: string;
  status?: string;
}) {
  const text = message?.trim();
  if (!text) return null;
  return (
    <p
      className="execution-status-text"
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
export function ExecutionSummary({
  status,
  details,
  stats,
  startTime,
  endTime,
  statusMessage,
  leading,
  action,
}: {
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
}) {
  const { locale, t } = useLocale();
  return (
    <section className="execution-summary">
      <div className="execution-summary-head">
        <div>
          {leading}
          <StatusBadge status={status} />
          {details.map((detail, index) => (
            <span key={index}>{detail}</span>
          ))}
        </div>
        {action}
      </div>
      <dl className="execution-stats">
        {stats.map(({ label, value, tone }) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd className={tone ? toneClasses[tone] : undefined}>
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

/** A titled list inside an execution dialog, such as its tasks. */
export function ExecutionSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section className="replication-task-section">
      <div className="section-heading compact-heading">
        <div>
          <h3>{t(title)}</h3>
          <p>{summary}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The loading state inside a dialog body. */
export function DialogLoading({ message }: { message: string }) {
  const { t } = useLocale();
  return (
    <div className="dialog-loading" role="status">
      <span className="spinner" />
      <span>{t(message)}</span>
    </div>
  );
}
