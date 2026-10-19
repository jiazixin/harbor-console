import { useEffect, useState } from "react";

import { controlApi } from "../../app/api-client";
import {
  formatDate,
  formatItemRange,
  formatNumber,
} from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ReplicationExecution,
  ReplicationPolicy,
  ReplicationTask,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { EmptyState } from "../../components/empty-state";
import {
  DialogLoading,
  ExecutionSection,
  ExecutionSummary,
} from "../../components/execution-summary";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { TaskLogPanel, useTaskLog } from "../../components/task-log-panel";

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
      <div className="notice notice-info">
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
      <div className="notice notice-danger">
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
      <div className="notice notice-danger">
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
  const executionId = initialExecution.id;

  const taskLog = useTaskLog<ReplicationTask>((task, signal) =>
    controlApi
      .data<unknown>(
        "replication-task-log",
        { id: execution.id, task: task.id },
        signal,
      )
      .then(logText),
  );

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
        <DialogLoading message="正在载入复制任务..." />
      ) : error ? (
        <ErrorView title="复制任务载入失败" message={error} />
      ) : (
        <>
          <ExecutionSummary
            status={execution.status}
            details={[
              triggerLabel(execution.trigger, t),
              formatDate(execution.start_time, locale),
            ]}
            stats={[
              { label: "总任务", value: execution.total ?? taskTotal },
              { label: "成功", value: execution.succeed, tone: "success" },
              { label: "失败", value: execution.failed, tone: "danger" },
              { label: "进行中", value: execution.in_progress },
              { label: "已停止", value: execution.stopped },
            ]}
            startTime={execution.start_time}
            endTime={execution.end_time}
            statusMessage={execution.status_text}
            action={
              canStop ? (
                <button
                  className="button button-small button-danger"
                  type="button"
                  onClick={() => setStopConfirm(true)}
                >
                  <Icon name="x" />
                  <span>{t("停止执行")}</span>
                </button>
              ) : null
            }
          />
          <ExecutionSection
            title="复制任务"
            summary={formatItemRange(1, tasks.length, taskTotal, locale)}
          >
            <div className="table-scroll replication-task-table">
              {!tasks.length ? (
                <EmptyState
                  title="暂无复制任务"
                  description="该执行记录还没有返回任务明细。"
                  icon="refresh"
                />
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
                              onClick={() => void taskLog.open(task)}
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
          </ExecutionSection>
          <TaskLogPanel
            log={taskLog}
            executionId={execution.id}
            fileName={`harbor-replication-${String(execution.id)}-${String(taskLog.task?.id ?? "")}.log`}
            labels={{
              refresh: "刷新复制任务日志",
              copy: "复制当前任务日志",
              download: "下载复制任务日志",
              close: "关闭复制任务日志",
              empty: "Harbor 没有返回复制任务日志。",
              nothingToDownload: "当前没有可下载的复制任务日志",
              downloaded: "复制任务日志已下载",
              region: "复制任务日志",
            }}
            onNotice={onNotice}
          />
        </>
      )}
    </ControlDialog>
  );
}
