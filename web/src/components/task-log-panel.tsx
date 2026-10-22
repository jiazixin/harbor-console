import { useCallback, useEffect, useRef, useState } from "react";

import { downloadText } from "../app/download-text";
import { formatNumber } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import { Icon } from "./icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "./structured-log";

type LogTask = { id: number };

/**
 * Loads the log of one task at a time. A newer request or closing the log
 * cancels the previous request, so an old response never replaces a newer one.
 */
export function useTaskLog<Task extends LogTask>(
  loadLog: (task: Task, signal: AbortSignal) => Promise<string | undefined>,
) {
  const [task, setTask] = useState<Task>();
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const latestRequest = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const panelRef = useRef<HTMLElement>(null);
  const loader = useRef(loadLog);
  loader.current = loadLog;

  const cancel = useCallback(() => {
    latestRequest.current += 1;
    controller.current?.abort();
  }, []);

  useEffect(() => cancel, [cancel]);

  // Bring a freshly loaded log into view and move keyboard focus to it.
  useEffect(() => {
    if (!task || loading) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    panelRef.current?.focus({ preventScroll: true });
  }, [loading, task]);

  const open = useCallback(
    async (nextTask: Task) => {
      cancel();
      const requestController = new AbortController();
      controller.current = requestController;
      const request = latestRequest.current;
      setTask(nextTask);
      setLog("");
      setLoading(true);
      try {
        const value = await loader.current(nextTask, requestController.signal);
        if (latestRequest.current === request) setLog(value ?? "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        if (latestRequest.current === request) {
          setLog(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (latestRequest.current === request) setLoading(false);
      }
    },
    [cancel],
  );

  const close = useCallback(() => {
    cancel();
    setTask(undefined);
    setLog("");
  }, [cancel]);

  return { task, log, loading, timezone, setTimezone, panelRef, open, close };
}

type TaskLog<Task extends LogTask> = ReturnType<typeof useTaskLog<Task>>;

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

export function TaskLogPanel<Task extends LogTask>({
  log,
  executionId,
  fileName,
  labels,
  onNotice,
}: {
  log: TaskLog<Task>;
  executionId: number | string | undefined;
  fileName: string;
  labels: TaskLogLabels;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  if (!log.task) return null;
  const task = log.task;
  const execution = String(executionId ?? "-");
  return (
    <section ref={log.panelRef} className="replication-log-view" tabIndex={-1}>
      <header>
        <div>
          <h3>{t("任务日志")}</h3>
          <p>
            {locale === "en-US"
              ? `Execution #${execution} · Task #${String(task.id)}`
              : `执行 #${execution} · 任务 #${String(task.id)}`}
          </p>
        </div>
        <div className="log-view-actions">
          <span>
            {log.loading
              ? t("正在读取")
              : locale === "en-US"
                ? `${formatNumber(log.log.length, locale)} characters`
                : `${formatNumber(log.log.length, locale)} 字符`}
          </span>
          <LogTimezoneControl value={log.timezone} onChange={log.setTimezone} />
          <button
            className="icon-button"
            type="button"
            title={t("刷新日志")}
            aria-label={t(labels.refresh)}
            onClick={() => void log.open(task)}
          >
            <Icon name="refresh" />
          </button>
          <button
            className="icon-button"
            type="button"
            title={t("复制日志")}
            aria-label={t(labels.copy)}
            onClick={() =>
              void navigator.clipboard
                .writeText(log.log)
                .then(() => onNotice("已复制到剪贴板"))
                .catch(() => onNotice("无法写入剪贴板", true))
            }
          >
            <Icon name="copy" />
          </button>
          <button
            className="icon-button"
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
            className="icon-button"
            type="button"
            title={t("关闭日志")}
            aria-label={t(labels.close)}
            onClick={log.close}
          >
            <Icon name="x" />
          </button>
        </div>
      </header>
      <StructuredLog
        value={log.log}
        timezone={log.timezone}
        emptyMessage={labels.empty}
        ariaLabel={labels.region}
      />
    </section>
  );
}
