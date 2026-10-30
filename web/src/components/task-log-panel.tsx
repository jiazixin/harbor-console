import { createClassNames } from "../lib/css/class-names";
import { ErrorView } from "./error-view";
import uiStyles0 from "./shared-ui.module.css";
import uiStyles1 from "./task-log-panel.module.css";
import type { TaskLog } from "./use-task-log";

import { useEffect, useRef } from "react";
import { downloadText } from "../app/download-text";
import { useLocale } from "../app/locale-context";
import { formatNumber } from "../lib/format/formatters";
import { Icon } from "./icon";
import { LogTimezoneControl } from "./log-timezone-control";
import { StructuredLog } from "./structured-log";

type LogTask = { id: number };
/** Translation keys for the accessible names and messages of one log type. */
type TaskLogLabels = {
  refresh: string;
  copy: string;
  download: string;
  close: string;
  empty: string;
  nothingToDownload: string;
  downloaded: string;
  region?: string;
};

type TaskLogPanelProps<Task extends LogTask> = {
  log: TaskLog<Task>;
  executionId: number | string | undefined;
  fileName: string;
  labels: TaskLogLabels;
  onNotice: (message: string, error?: boolean) => void;
};

export function TaskLogPanel<Task extends LogTask>({
  log,
  executionId,
  fileName,
  labels,
  onNotice,
}: TaskLogPanelProps<Task>) {
  const { locale, t } = useLocale();
  const panelRef = useRef<HTMLElement>(null);
  const { task, loading } = log;

  // Bring a freshly loaded log into view and move keyboard focus to it.
  useEffect(() => {
    if (!task || loading) return;
    const panel = panelRef.current;
    const previous = document.activeElement;
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    panel?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement === panel && previous instanceof HTMLElement)
        previous.focus({ preventScroll: true });
    };
  }, [loading, task]);

  if (!task) return null;
  const execution = String(executionId ?? "-");
  return (
    <section
      ref={panelRef}
      className={resolveClasses("replication-log-view")}
      tabIndex={-1}
    >
      <header>
        <div>
          <h3>{t("任务日志")}</h3>
          <p>
            {locale === "en-US"
              ? `Execution #${execution} · Task #${String(task.id)}`
              : `执行 #${execution} · 任务 #${String(task.id)}`}
          </p>
        </div>
        <div className={resolveClasses("log-view-actions")}>
          <span>
            {(() => {
              if (log.loading) {
                return t("正在读取");
              }
              if (locale === "en-US") {
                return `${formatNumber(log.log.length, locale)} characters`;
              }
              return `${formatNumber(log.log.length, locale)} 字符`;
            })()}
          </span>
          <LogTimezoneControl value={log.timezone} onChange={log.setTimezone} />
          <button
            className={resolveClasses("icon-button")}
            type="button"
            title={t("刷新日志")}
            aria-label={t(labels.refresh)}
            onClick={() => void log.open(task)}
          >
            <Icon name="refresh" />
          </button>
          <button
            className={resolveClasses("icon-button")}
            type="button"
            title={t("复制日志")}
            aria-label={t(labels.copy)}
            onClick={() =>
              void navigator.clipboard
                .writeText(log.log)
                .then(() => {
                  onNotice("已复制到剪贴板");
                })
                .catch(() => {
                  onNotice("无法写入剪贴板", true);
                })
            }
          >
            <Icon name="copy" />
          </button>
          <button
            className={resolveClasses("icon-button")}
            type="button"
            title={t("下载日志")}
            aria-label={t(labels.download)}
            onClick={() => {
              if (!log.log) {
                onNotice(labels.nothingToDownload, true);
                return;
              }
              downloadText(log.log, fileName);
              onNotice(labels.downloaded);
            }}
          >
            <Icon name="download" />
          </button>
          <button
            className={resolveClasses("icon-button")}
            type="button"
            title={t("关闭日志")}
            aria-label={t(labels.close)}
            onClick={log.close}
          >
            <Icon name="x" />
          </button>
        </div>
      </header>
      {log.error ? (
        <ErrorView message={log.error} retry={() => void log.open(task)} />
      ) : null}
      <StructuredLog
        value={log.log}
        timezone={log.timezone}
        emptyMessage={labels.empty}
        ariaLabel={labels.region}
      />
    </section>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "log-timezone-control": uiStyles0.logTimezoneControl,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
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
  "replication-log-view": uiStyles1.replicationLogView,
  "log-view-actions": uiStyles1.logViewActions,
});
