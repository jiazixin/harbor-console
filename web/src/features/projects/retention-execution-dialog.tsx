import { useMemo, useState } from "react";
import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  RetentionExecution,
  RetentionPolicy,
  RetentionTask,
} from "../../app/models";
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
import { TaskLogPanel } from "../../components/task-log-panel";
import { useTaskLog } from "../../components/use-task-log";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatDate,
  formatDuration,
  formatNumber,
} from "../../lib/format/formatters";
import { DialogPagination } from "./dialog-pagination";
import { projectKeys } from "./project-keys";

function displayText(value: string | undefined): string {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) return "-";
  return normalized;
}

function emptyPagination(): ControlPagination {
  return { page: 1, page_size: 20, total: 0 };
}

function failedTask(task: RetentionTask): boolean {
  return ["failed", "error"].includes(task.status?.toLowerCase() ?? "");
}

function runningTask(task: RetentionTask): boolean {
  return ["running", "inprogress", "in_progress"].includes(
    task.status?.toLowerCase() ?? "",
  );
}

type RetentionExecutionDialogProps = {
  project: string;
  policy: RetentionPolicy;
  execution: RetentionExecution;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function RetentionExecutionDialog({
  project,
  policy,
  execution,
  onClose,
  onNotice,
}: RetentionExecutionDialogProps) {
  const { locale, t } = useLocale();
  const [page, setPage] = useState(1);
  const tasksQuery = useRetentionExecutionData({ policy, execution, page });
  const tasks = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data]);
  const pagination = tasksQuery.data?.pagination ?? emptyPagination();
  const loading = tasksQuery.loading;
  const error = tasksQuery.error;

  const taskLog = useTaskLog<RetentionTask>(
    (task, signal) =>
      controlApi.data<string>(
        "retention-task-log",
        { id: policy.id, eid: execution.id, tid: task.id },
        signal,
      ),
    projectKeys.taskLog("retention-log", [project, execution.id]),
  );

  const metrics = (() => {
    const total = tasks.reduce((sum, task) => sum + (task.total ?? 0), 0);
    const retained = tasks.reduce((sum, task) => sum + (task.retained ?? 0), 0);
    return {
      total,
      retained,
      cleanup: Math.max(0, total - retained),
      failed: tasks.filter(failedTask).length,
      running: tasks.filter(runningTask).length,
    };
  })();

  return (
    <ControlDialog
      title={`Tag 保留执行 #${String(execution.id)}`}
      subtitle={project}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass={resolveClasses("control-dialog-wide")}
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={onClose}
    >
      {(() => {
        if (loading) {
          return <DialogLoading message="正在载入 Tag 保留任务..." />;
        }
        if (error) {
          return <ErrorView title="Tag 保留任务载入失败" message={error} />;
        }
        return (
          <>
            <ExecutionSummary
              status={execution.status}
              details={[
                t(execution.dry_run ? "仅演练" : "正式执行"),
                formatDate(execution.start_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                }),
              ]}
              stats={[
                { label: "仓库任务", value: pagination.total },
                { label: "匹配 Tag", value: metrics.total },
                { label: "保留 Tag", value: metrics.retained, tone: "success" },
                { label: "清理 Tag", value: metrics.cleanup },
                { label: "失败", value: metrics.failed, tone: "danger" },
                { label: "进行中", value: metrics.running },
              ]}
            />
            <ExecutionSection
              title="仓库处理结果"
              summary={
                locale === "en-US"
                  ? `${formatNumber(pagination.total, locale)} items`
                  : `共 ${formatNumber(pagination.total, locale)} 项`
              }
            >
              <div
                className={resolveClasses(
                  "table-scroll replication-task-table",
                )}
              >
                {!tasks.length ? (
                  <EmptyState
                    title="暂无仓库任务"
                    description="该执行记录还没有返回仓库处理结果。"
                    icon="history"
                  />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{t("仓库")}</th>
                        <th>{t("匹配 Tag")}</th>
                        <th>{t("保留")}</th>
                        <th>{t("清理")}</th>
                        <th>{t("状态码")}</th>
                        <th>{t("状态")}</th>
                        <th className={resolveClasses("table-cell-time")}>
                          {t("耗时")}
                        </th>
                        <th>{t("日志")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task, taskIndex) => (
                        <tr
                          key={`${String(task.id)}-${String(task.repository ?? taskIndex)}`}
                        >
                          <td>
                            <div className={resolveClasses("cell-title")}>
                              <strong>{displayText(task.repository)}</strong>
                            </div>
                          </td>
                          <td>{formatNumber(task.total, locale)}</td>
                          <td className={resolveClasses("success-text")}>
                            {formatNumber(task.retained, locale)}
                          </td>
                          <td>
                            {formatNumber(
                              Math.max(
                                0,
                                (task.total ?? 0) - (task.retained ?? 0),
                              ),
                              locale,
                            )}
                          </td>
                          <td className={resolveClasses("mono")}>
                            {task.status_code ?? "-"}
                          </td>
                          <td>
                            <StatusBadge status={task.status} />
                          </td>
                          <td>
                            {formatDuration(
                              task.start_time,
                              task.end_time,
                              locale,
                            )}
                          </td>
                          <td>
                            <button
                              className={resolveClasses("icon-button")}
                              type="button"
                              title={t("查看日志")}
                              aria-label={t("查看 Tag 保留任务日志")}
                              onClick={() => void taskLog.open(task)}
                            >
                              <Icon name="history" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <DialogPagination
                pagination={pagination}
                onPageChange={setPage}
              />
            </ExecutionSection>
            <TaskLogPanel
              log={taskLog}
              executionId={execution.id}
              fileName={`harbor-retention-${String(execution.id)}-${String(taskLog.task?.id ?? "")}.log`}
              labels={{
                refresh: "刷新 Tag 保留任务日志",
                copy: "复制 Tag 保留任务日志",
                download: "下载 Tag 保留任务日志",
                close: "关闭 Tag 保留任务日志",
                empty: "Harbor 没有返回 Tag 保留任务日志。",
                nothingToDownload: "当前没有可下载的 Tag 保留任务日志",
                downloaded: "Tag 保留任务日志已下载",
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
  "control-dialog-wide": uiStyles0.controlDialogWide,
  "table-scroll": uiStyles0.tableScroll,
  "replication-task-table": uiStyles0.replicationTaskTable,
  "table-cell-time": uiStyles0.tableCellTime,
  "cell-title": uiStyles0.cellTitle,
  "success-text": uiStyles0.successText,
  mono: uiStyles0.mono,
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
});

function useRetentionExecutionData({
  policy,
  execution,
  page,
}: {
  policy: RetentionPolicy;
  execution: RetentionExecution;
  page: number;
}) {
  return useLoadedQuery(
    projectKeys.retention({ policy: policy.id, execution: execution.id, page }),
    (signal) =>
      controlApi.list<RetentionTask>(
        "retention-tasks",
        { id: policy.id, eid: execution.id, page, page_size: 20 },
        signal,
      ),
  );
}
