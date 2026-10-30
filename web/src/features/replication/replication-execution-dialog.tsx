import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { ReplicationExecution, ReplicationTask } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { ControlDialog } from "../../components/control-dialog";
import { DialogLoading } from "../../components/dialog-loading";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { ExecutionSection } from "../../components/execution-section";
import { ExecutionSummary } from "../../components/execution-summary";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatusBadge } from "../../components/status-badge";
import { triggerLabel } from "../../components/status-badge-support";
import { TaskLogPanel } from "../../components/task-log-panel";
import { useTaskLog } from "../../components/use-task-log";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatDate,
  formatItemRange,
  formatNumber,
} from "../../lib/format/formatters";
import { replicationKeys } from "./replication-keys";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries } from "./replication-dialogs-support";
import styles from "./replication.module.css";

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
  return (() => {
    if (value) {
      return formatDate(value, { locale: locale, timeZone: displayTimeZone() });
    }
    if (locale === "en-US") {
      return "None";
    }
    return "暂无";
  })();
}

function logText(value: unknown): string {
  return typeof value === "string"
    ? value
    : JSON.stringify(value ?? "", null, 2);
}

type StopReplicationExecutionDialogProps = {
  execution: ReplicationExecution;
  onClose: () => void;
  onStopped: () => void;
};

function StopReplicationExecutionDialog({
  execution,
  onClose,
  onStopped,
}: StopReplicationExecutionDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: "replication-execution",
          parameters: { id: execution.id },
          method: "PUT",
        });
        onStopped();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>
          {t("已完成的任务不会回滚，正在传输的任务将由 Harbor 请求停止。")}
        </span>
      </div>
    </ControlDialog>
  );
}

type ReplicationExecutionDialogProps = {
  execution: ReplicationExecution;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function ReplicationExecutionDialog({
  execution: initialExecution,
  onClose,
  onChanged,
  onNotice,
}: ReplicationExecutionDialogProps) {
  const { locale, t } = useLocale();
  const [stopConfirm, setStopConfirm] = useState(false);
  const executionId = initialExecution.id;
  const detailQuery = useReplicationExecutionData({ executionId });
  const execution = detailQuery.data?.detail ?? initialExecution;
  const tasks = detailQuery.data?.collection.items ?? [];
  const taskTotal = detailQuery.data?.collection.pagination.total ?? 0;
  const loading = detailQuery.loading;
  const error = detailQuery.error;

  const taskLog = useTaskLog<ReplicationTask>(
    (task, signal) =>
      controlApi
        .data<unknown>(
          "replication-task-log",
          { id: execution.id, task: task.id },
          signal,
        )
        .then(logText),
    replicationKeys.taskLog("task-log", [execution.id]),
  );

  if (stopConfirm) {
    return (
      <StopReplicationExecutionDialog
        execution={execution}
        onClose={() => {
          setStopConfirm(false);
        }}
        onStopped={() => {
          onChanged("已向 Harbor 提交停止请求");
        }}
      />
    );
  }

  const canStop = execution.status?.toLowerCase() === "inprogress";
  const subtitle = (() => {
    if (loading) {
      return t("正在读取执行详情和任务列表");
    }
    if (locale === "en-US") {
      return `${t(executionStatusLabel(execution.status))} · ${formatNumber(taskTotal, locale)} tasks`;
    }
    return `${t(executionStatusLabel(execution.status))} · ${formatNumber(taskTotal, locale)} 个任务`;
  })();

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
      dialogClass={resolveClasses("control-dialog-wide")}
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      {(() => {
        if (loading) {
          return <DialogLoading message="正在载入复制任务..." />;
        }
        if (error) {
          return <ErrorView title="复制任务载入失败" message={error} />;
        }
        return (
          <>
            <ExecutionSummary
              status={execution.status}
              details={[
                triggerLabel(execution.trigger, t),
                formatDate(execution.start_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                }),
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
                    className={resolveClasses(
                      "button button-small button-danger",
                    )}
                    type="button"
                    onClick={() => {
                      setStopConfirm(true);
                    }}
                  >
                    <Icon name="x" />
                    <span>{t("停止执行")}</span>
                  </button>
                ) : null
              }
            />
            <ExecutionSection
              title="复制任务"
              summary={formatItemRange({
                start: 1,
                end: tasks.length,
                total: taskTotal,
                locale: locale,
              })}
            >
              <div
                className={resolveClasses(
                  "table-scroll replication-task-table",
                )}
              >
                {!tasks.length ? (
                  <EmptyState
                    title="暂无复制任务"
                    description="该执行记录还没有返回任务明细。"
                    icon="refresh"
                  />
                ) : (
                  <table
                    className={resolveClasses(styles.replicationTaskTableGrid)}
                  >
                    <thead>
                      <tr>
                        <th className={resolveClasses("id-column")}>
                          {t("任务")}
                        </th>
                        <th>{t("资源类型")}</th>
                        <th
                          className={resolveClasses(
                            styles.replicationTaskSource,
                          )}
                        >
                          {t("源")}
                        </th>
                        <th
                          className={resolveClasses(
                            styles.replicationTaskTarget,
                          )}
                        >
                          {t("目标")}
                        </th>
                        <th
                          className={resolveClasses(
                            styles.replicationTaskOperation,
                          )}
                        >
                          {t("操作")}
                        </th>
                        <th
                          className={resolveClasses(
                            styles.replicationTaskStatus,
                          )}
                        >
                          {t("状态")}
                        </th>
                        <th
                          className={resolveClasses(
                            `${styles.replicationTaskStartTime} table-cell-time`,
                          )}
                        >
                          {t("开始时间")}
                        </th>
                        <th
                          className={resolveClasses(
                            `${styles.replicationTaskEndTime} table-cell-time`,
                          )}
                        >
                          {t("结束时间")}
                        </th>
                        <th
                          className={resolveClasses(styles.replicationTaskLog)}
                        >
                          {t("日志")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id}>
                          <td className={resolveClasses("id-cell")}>
                            #{task.id}
                          </td>
                          <td>
                            {locale === "en-US" &&
                            resourceTypeLabel(task.resource_type) === "镜像"
                              ? "Images"
                              : t(resourceTypeLabel(task.resource_type))}
                          </td>
                          <td
                            className={resolveClasses(
                              styles.replicationTaskSource,
                            )}
                          >
                            <span
                              className={resolveClasses(
                                "replication-resource mono",
                              )}
                              title={task.src_resource}
                            >
                              {task.src_resource ?? "-"}
                            </span>
                          </td>
                          <td
                            className={resolveClasses(
                              styles.replicationTaskTarget,
                            )}
                          >
                            <span
                              className={resolveClasses(
                                "replication-resource mono",
                              )}
                              title={task.dst_resource}
                            >
                              {task.dst_resource ?? "-"}
                            </span>
                          </td>
                          <td
                            className={resolveClasses(
                              styles.replicationTaskOperation,
                            )}
                          >
                            {t(operationLabel(task.operation))}
                          </td>
                          <td
                            className={resolveClasses(
                              styles.replicationTaskStatus,
                            )}
                          >
                            <StatusBadge status={task.status} />
                          </td>
                          <td
                            className={resolveClasses(
                              `${styles.replicationTaskStartTime} table-cell-time`,
                            )}
                          >
                            {formatDate(task.start_time, {
                              locale: locale,
                              timeZone: displayTimeZone(),
                            })}
                          </td>
                          <td
                            className={resolveClasses(
                              `${styles.replicationTaskEndTime} table-cell-time`,
                            )}
                          >
                            {replicationTaskDate(task.end_time, locale)}
                          </td>
                          <td
                            className={resolveClasses(
                              styles.replicationTaskLog,
                            )}
                          >
                            {task.status?.toLowerCase() === "initialized" ? (
                              "-"
                            ) : (
                              <button
                                className={resolveClasses("icon-button")}
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
        );
      })()}
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "dialog-loading": uiStyles0.dialogLoading,
  "empty-state": uiStyles0.emptyState,
  "execution-summary": uiStyles0.executionSummary,
  icon: uiStyles0.icon,
  "status-badge": uiStyles0.statusBadge,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
  "control-dialog-wide": uiStyles0.controlDialogWide,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-danger": uiStyles0.buttonDanger,
  "table-scroll": uiStyles0.tableScroll,
  "replication-task-table": uiStyles0.replicationTaskTable,
  "id-column": uiStyles0.idColumn,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  "replication-resource": uiStyles0.replicationResource,
  mono: uiStyles0.mono,
  "icon-button": uiStyles0.iconButton,
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

function useReplicationExecutionData({
  executionId,
}: {
  executionId: number | undefined;
}) {
  return useLoadedQuery(
    replicationKeys.executionTasks({ id: executionId }),
    async (signal) => {
      const [detail, collection] = await Promise.all([
        controlApi.data<ReplicationExecution>(
          "replication-execution",
          { id: executionId },
          signal,
        ),
        controlApi.list<ReplicationTask>(
          "replication-tasks",
          { id: executionId, page: 1, page_size: 100, sort: "-start_time" },
          signal,
        ),
      ]);
      return { detail, collection };
    },
  );
}
