import { useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ReplicationExecution,
  ReplicationPolicy,
  ReplicationTask,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import { StatusBadge, triggerLabel } from "../../components/status-badge";

function resourceTypeLabel(value: string | undefined): string {
  return (
    {
      image: "镜像",
      artifact: "制品",
      repository: "仓库",
      project: "项目",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "其他"
  );
}

function operationLabel(value: string | undefined): string {
  return (
    {
      copy: "复制",
      delete: "删除",
      pull: "拉取",
      push: "推送",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "-"
  );
}

function executionStatusLabel(value: string | undefined): string {
  return (
    {
      inprogress: "进行中",
      in_progress: "进行中",
      succeed: "成功",
      success: "成功",
      failed: "失败",
      stopped: "已停止",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "未知"
  );
}

function replicationTaskDate(
  value: string | undefined,
  locale: "en-US" | "zh-CN",
): string {
  return value
    ? formatDate(value, locale)
    : locale === "en-US"
      ? "None"
      : "暂无";
}

function logText(value: unknown): string {
  return typeof value === "string"
    ? value
    : JSON.stringify(value ?? "", null, 2);
}

export function RunReplicationPolicyDialog({
  policy,
  onClose,
  onStarted,
}: {
  policy: ReplicationPolicy;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="立即执行复制策略"
      subtitle={policy.name}
      submitLabel="启动复制"
      submitIcon="play"
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("replication-executions", {}, "POST", {
          policy_id: policy.id,
        });
        onStarted();
      }}
    >
      <div className="destructive-message">
        <Icon name="info" />
        <span>
          {t("Harbor 将立即创建一次复制执行，可在执行记录中查看进度。")}
        </span>
      </div>
    </ControlDialog>
  );
}

export function DeleteReplicationPolicyDialog({
  policy,
  onClose,
  onDeleted,
}: {
  policy: ReplicationPolicy;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useLocale();
  return (
    <ControlDialog
      title="删除复制策略"
      subtitle={policy.name}
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "replication-policy",
          { id: policy.id },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {locale === "en-US"
            ? `Policy ${policy.name ?? "-"} will be permanently deleted.`
            : `策略 ${policy.name ?? "-"} 将被永久删除。`}
        </span>
      </div>
    </ControlDialog>
  );
}

export function StopReplicationExecutionDialog({
  execution,
  onClose,
  onStopped,
}: {
  execution: ReplicationExecution;
  onClose: () => void;
  onStopped: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="停止复制执行"
      subtitle={`执行 #${String(execution.id ?? "-")}`}
      submitLabel="停止执行"
      submitIcon="x"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "replication-execution",
          { id: execution.id },
          "PUT",
        );
        onStopped();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {t("已完成的任务不会回滚，正在传输的任务将由 Harbor 请求停止。")}
        </span>
      </div>
    </ControlDialog>
  );
}

export function ReplicationExecutionDialog({
  execution: initialExecution,
  onClose,
  onChanged,
  onNotice,
}: {
  execution: ReplicationExecution;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [execution, setExecution] = useState(initialExecution);
  const [tasks, setTasks] = useState<ReplicationTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stopConfirm, setStopConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ReplicationTask>();
  const [taskLog, setTaskLog] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const logController = useRef<AbortController | undefined>(undefined);
  const logVersion = useRef(0);
  const logView = useRef<HTMLElement>(null);
  const executionId = initialExecution.id;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void Promise.all([
      controlApi.data<ReplicationExecution>(
        "replication-execution",
        { id: executionId },
        controller.signal,
      ),
      controlApi.list<ReplicationTask>(
        "replication-tasks",
        { id: executionId, page: 1, page_size: 100, sort: "-start_time" },
        controller.signal,
      ),
    ])
      .then(([detail, collection]) => {
        if (controller.signal.aborted) return;
        if (detail) setExecution(detail);
        setTasks(collection.items);
        setTaskTotal(collection.pagination.total);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [executionId]);

  useEffect(
    () => () => {
      logVersion.current += 1;
      logController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!selectedTask || logLoading) return;
    logView.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    logView.current?.focus({ preventScroll: true });
  }, [logLoading, selectedTask]);

  async function loadTaskLog(task: ReplicationTask) {
    logController.current?.abort();
    const controller = new AbortController();
    logController.current = controller;
    const version = logVersion.current + 1;
    logVersion.current = version;
    setSelectedTask(task);
    setTaskLog("");
    setLogLoading(true);
    try {
      const value = await controlApi.data<unknown>(
        "replication-task-log",
        { id: execution.id, task: task.id },
        controller.signal,
      );
      if (logVersion.current === version) setTaskLog(logText(value));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError")
        return;
      if (logVersion.current === version)
        setTaskLog(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
    } finally {
      if (logVersion.current === version) setLogLoading(false);
    }
  }

  if (stopConfirm) {
    return (
      <StopReplicationExecutionDialog
        execution={execution}
        onClose={() => setStopConfirm(false)}
        onStopped={() => onChanged("已向 Harbor 提交停止请求")}
      />
    );
  }

  const canStop = execution.status?.toLowerCase() === "inprogress";
  const subtitle = loading
    ? t("正在读取执行详情和任务列表")
    : locale === "en-US"
      ? `${t(executionStatusLabel(execution.status))} · ${formatNumber(taskTotal, locale)} tasks`
      : `${t(executionStatusLabel(execution.status))} · ${formatNumber(taskTotal, locale)} 个任务`;

  return (
    <ControlDialog
      title={
        locale === "en-US"
          ? `Replication execution #${String(execution.id ?? "-")}`
          : `复制执行 #${String(execution.id ?? "-")}`
      }
      subtitle={subtitle}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass="control-dialog-wide"
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      {loading ? (
        <div className="dialog-loading" role="status">
          <span className="spinner" />
          <span>{t("正在载入复制任务...")}</span>
        </div>
      ) : error ? (
        <div className="empty-table permission-table">
          <strong>{t("复制任务载入失败")}</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <section className="execution-summary">
            <div className="execution-summary-head">
              <div>
                <StatusBadge status={execution.status} />
                <span>{triggerLabel(execution.trigger, t)}</span>
                <span>{formatDate(execution.start_time, locale)}</span>
              </div>
              {canStop ? (
                <button
                  className="button button-small button-danger"
                  type="button"
                  onClick={() => setStopConfirm(true)}
                >
                  <Icon name="x" />
                  <span>{t("停止执行")}</span>
                </button>
              ) : null}
            </div>
            <dl className="execution-stats">
              {[
                ["总任务", execution.total ?? taskTotal, ""],
                ["成功", execution.succeed, "success-text"],
                ["失败", execution.failed, "danger-text"],
                ["进行中", execution.in_progress, ""],
                ["已停止", execution.stopped, ""],
              ].map(([label, value, className]) => (
                <div key={String(label)}>
                  <dt>{t(String(label))}</dt>
                  <dd className={String(className)}>
                    {formatNumber(value as number | undefined, locale)}
                  </dd>
                </div>
              ))}
              <div>
                <dt>{t("耗时")}</dt>
                <dd>
                  {formatDuration(
                    execution.start_time,
                    execution.end_time,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="replication-task-section">
            <div className="section-heading compact-heading">
              <div>
                <h3>{t("复制任务")}</h3>
                <p>
                  {locale === "en-US"
                    ? `Items 1-${formatNumber(tasks.length, locale)} of ${formatNumber(taskTotal, locale)}`
                    : `第 1-${formatNumber(tasks.length, locale)} 项，共 ${formatNumber(taskTotal, locale)} 项`}
                </p>
              </div>
            </div>
            <div className="table-scroll replication-task-table">
              {!tasks.length ? (
                <div className="empty-table">
                  <strong>{t("暂无复制任务")}</strong>
                  <span>{t("该执行记录还没有返回任务明细。")}</span>
                </div>
              ) : (
                <table className="replication-task-table-grid">
                  <thead>
                    <tr>
                      <th className="id-column">{t("任务")}</th>
                      <th>{t("资源类型")}</th>
                      <th className="replication-task-source">{t("源")}</th>
                      <th className="replication-task-target">{t("目标")}</th>
                      <th className="replication-task-operation">
                        {t("操作")}
                      </th>
                      <th className="replication-task-status">{t("状态")}</th>
                      <th className="replication-task-start-time table-cell-time">
                        {t("开始时间")}
                      </th>
                      <th className="replication-task-end-time table-cell-time">
                        {t("结束时间")}
                      </th>
                      <th className="replication-task-log">{t("日志")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="id-cell">#{task.id}</td>
                        <td>
                          {locale === "en-US" &&
                          resourceTypeLabel(task.resource_type) === "镜像"
                            ? "Images"
                            : t(resourceTypeLabel(task.resource_type))}
                        </td>
                        <td className="replication-task-source">
                          <span
                            className="replication-resource mono"
                            title={task.src_resource}
                          >
                            {task.src_resource ?? "-"}
                          </span>
                        </td>
                        <td className="replication-task-target">
                          <span
                            className="replication-resource mono"
                            title={task.dst_resource}
                          >
                            {task.dst_resource ?? "-"}
                          </span>
                        </td>
                        <td className="replication-task-operation">
                          {t(operationLabel(task.operation))}
                        </td>
                        <td className="replication-task-status">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="replication-task-start-time table-cell-time">
                          {formatDate(task.start_time, locale)}
                        </td>
                        <td className="replication-task-end-time table-cell-time">
                          {replicationTaskDate(task.end_time, locale)}
                        </td>
                        <td className="replication-task-log">
                          {task.status?.toLowerCase() === "initialized" ? (
                            "-"
                          ) : (
                            <button
                              className="icon-button"
                              type="button"
                              title={t("查看日志")}
                              aria-label={
                                locale === "en-US"
                                  ? `View task ${String(task.id)} log`
                                  : `查看任务 ${String(task.id)} 日志`
                              }
                              onClick={() => void loadTaskLog(task)}
                            >
                              <Icon name="history" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
          {selectedTask ? (
            <section
              ref={logView}
              className="replication-log-view"
              tabIndex={-1}
            >
              <header>
                <div>
                  <h3>{t("任务日志")}</h3>
                  <p>
                    {locale === "en-US"
                      ? `Execution #${String(execution.id)} · Task #${String(selectedTask.id)}`
                      : `执行 #${String(execution.id)} · 任务 #${String(selectedTask.id)}`}
                  </p>
                </div>
                <div className="log-view-actions">
                  <span>
                    {logLoading
                      ? t("正在读取")
                      : locale === "en-US"
                        ? `${formatNumber(taskLog.length, locale)} characters`
                        : `${formatNumber(taskLog.length, locale)} 字符`}
                  </span>
                  <LogTimezoneControl value={timezone} onChange={setTimezone} />
                  <button
                    className="icon-button"
                    type="button"
                    title={t("刷新日志")}
                    aria-label={t("刷新复制任务日志")}
                    onClick={() => void loadTaskLog(selectedTask)}
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("复制日志")}
                    aria-label={t("复制当前任务日志")}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(taskLog)
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
                    aria-label={t("下载复制任务日志")}
                    onClick={() => {
                      if (!taskLog) {
                        onNotice("当前没有可下载的复制任务日志", true);
                        return;
                      }
                      downloadText(
                        taskLog,
                        `harbor-replication-${String(execution.id)}-${String(selectedTask.id)}.log`,
                      );
                      onNotice("复制任务日志已下载");
                    }}
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("关闭日志")}
                    aria-label={t("关闭复制任务日志")}
                    onClick={() => {
                      logVersion.current += 1;
                      logController.current?.abort();
                      setSelectedTask(undefined);
                      setTaskLog("");
                    }}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              </header>
              <StructuredLog
                value={taskLog}
                timezone={timezone}
                emptyMessage="Harbor 没有返回复制任务日志。"
                ariaLabel="复制任务日志"
              />
            </section>
          ) : null}
        </>
      )}
    </ControlDialog>
  );
}
