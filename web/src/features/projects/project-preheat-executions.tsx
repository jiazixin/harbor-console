import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  PreheatExecution,
  PreheatPolicy,
  PreheatTask,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { useControlMutation } from "../../app/use-control-mutation";
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
import { artifactKeys } from "../artifacts/public";
import { repositoryKeys } from "../repositories/public";
import { DialogPagination } from "./dialog-pagination";
import { projectKeys } from "./project-keys";

// Queries that a write in this module can change.
const affectedQueries = [projectKeys.all, repositoryKeys.all, artifactKeys.all];

/** Harbor's largest page; execution history pages in steps of this size. */
const historyPageSize = 100;

function emptyPagination(): ControlPagination {
  return { page: 1, page_size: historyPageSize, total: 0 };
}

function triggerLabel(value: string | undefined): string {
  return (
    {
      manual: "手动",
      scheduled: "定时",
      event_based: "事件触发",
      "scheduled(paused)": "定时已暂停",
      Manual: "手动",
      Scheduled: "定时",
      Event: "事件触发",
    }[value ?? ""] ??
    value ??
    "手动"
  );
}

function shortDigest(value: string | undefined): string {
  if (!value) return "暂无摘要";
  return value.length > 22 ? `${value.slice(0, 15)}…${value.slice(-7)}` : value;
}

function resourceTypeLabel(value: string | undefined): string {
  return (
    {
      image: "镜像",
      artifact: "制品",
      repository: "仓库",
      project: "项目",
      replication: "复制任务",
      registry: "镜像仓库",
      user: "用户",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "其他"
  );
}

function canStopExecution(status: string | undefined): boolean {
  return ["pending", "running", "scheduled"].includes(
    status?.toLowerCase() ?? "",
  );
}

function executionStatusLabel(status: string | undefined): string {
  const normalized = status?.toLowerCase() ?? "";
  if (["succeed", "success", "succeeded"].includes(normalized)) return "成功";
  if (["running", "inprogress", "in_progress"].includes(normalized)) {
    return "运行中";
  }
  if (["pending", "queued"].includes(normalized)) return "等待中";
  if (normalized === "scheduled") return "已计划";
  if (["failed", "error"].includes(normalized)) return "失败";
  if (normalized === "stopped") return "已停止";
  if (normalized === "completed") return "已完成";
  return status ?? "未知";
}

/**
 * Loads the policy's executions, or the tasks of the selected execution.
 * Selecting an execution also refreshes its details from Harbor.
 */
function usePreheatExecutionHistory(project: string, policyName: string) {
  const [executionPage, setExecutionPage] = useState(1);
  const [selectedExecution, setSelectedExecution] =
    useState<PreheatExecution>();
  const [taskPage, setTaskPage] = useState(1);
  const selectedExecutionId = selectedExecution?.id;
  const executionsQuery = useLoadedQuery(
    projectKeys.preheatExecutions({ project, policyName, executionPage }),
    (signal) =>
      controlApi.list<PreheatExecution>(
        "preheat-executions",
        {
          project,
          name: policyName,
          page: executionPage,
          page_size: historyPageSize,
          sort: "-start_time",
        },
        signal,
      ),
    { enabled: selectedExecutionId === undefined },
  );
  // Enabled only with a selection, so the fallback id is never sent.
  const execution = {
    project,
    name: policyName,
    id: selectedExecutionId ?? 0,
  };
  const tasksQuery = useLoadedQuery(
    projectKeys.preheatExecutions({ ...execution, taskPage }),
    async (signal) => {
      const [details, collection] = await Promise.all([
        controlApi.data<PreheatExecution>(
          "preheat-execution",
          execution,
          signal,
        ),
        controlApi.list<PreheatTask>(
          "preheat-tasks",
          {
            ...execution,
            page: taskPage,
            page_size: historyPageSize,
            sort: "-creation_time",
          },
          signal,
        ),
      ]);
      return { details, collection };
    },
    { enabled: selectedExecutionId !== undefined },
  );
  const activeQuery =
    selectedExecutionId === undefined ? executionsQuery : tasksQuery;
  // Placeholder data may still belong to the previous selection.
  const details = tasksQuery.data?.details;

  return {
    executions: executionsQuery.data?.items ?? [],
    executionPagination: executionsQuery.data?.pagination ?? emptyPagination(),
    setExecutionPage,
    selectedExecution:
      details && details.id === selectedExecutionId
        ? details
        : selectedExecution,
    selectExecution: (next: PreheatExecution | undefined) => {
      setTaskPage(1);
      setSelectedExecution(next);
    },
    tasks: tasksQuery.data?.collection.items ?? [],
    taskPagination: tasksQuery.data?.collection.pagination ?? emptyPagination(),
    setTaskPage,
    loading: activeQuery.loading,
    error: activeQuery.error,
  };
}

type PreheatExecutionSummaryProps = {
  execution: PreheatExecution;
  taskTotal: number;
  onBack: () => void;
  onStop: () => void;
};

function PreheatExecutionSummary({
  execution,
  taskTotal,
  onBack,
  onStop,
}: PreheatExecutionSummaryProps) {
  const { locale, t } = useLocale();
  const metrics = execution.metrics;
  return (
    <ExecutionSummary
      status={execution.status}
      leading={
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={onBack}
        >
          <Icon name="chevron-left" />
          <span>{t("执行历史")}</span>
        </button>
      }
      details={[
        t(triggerLabel(execution.trigger)),
        formatDate(execution.start_time, {
          locale: locale,
          timeZone: displayTimeZone(),
        }),
      ]}
      stats={[
        { label: "总任务", value: metrics?.task_count ?? taskTotal },
        { label: "成功", value: metrics?.success_task_count, tone: "success" },
        { label: "失败", value: metrics?.error_task_count, tone: "danger" },
        { label: "进行中", value: metrics?.running_task_count },
        { label: "已停止", value: metrics?.stopped_task_count },
      ]}
      startTime={execution.start_time}
      endTime={execution.end_time}
      statusMessage={execution.status_message}
      action={
        canStopExecution(execution.status) ? (
          <button
            className={resolveClasses("button button-small button-danger")}
            type="button"
            onClick={onStop}
          >
            <Icon name="x" />
            <span>{t("停止执行")}</span>
          </button>
        ) : null
      }
    />
  );
}

type PreheatTaskTableProps = {
  tasks: PreheatTask[];
  onShowLog: (task: PreheatTask) => void;
};

function PreheatTaskTable({ tasks, onShowLog }: PreheatTaskTableProps) {
  const { locale, t } = useLocale();
  if (!tasks.length) {
    return (
      <EmptyState
        title="暂无预热任务"
        description="该执行记录还没有返回任务明细。"
        icon="play"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th className={resolveClasses("id-column")}>{t("任务")}</th>
          <th>{t("制品")}</th>
          <th>{t("摘要")}</th>
          <th>{t("类型")}</th>
          <th>{t("状态")}</th>
          <th>{locale === "en-US" ? "Retries" : "重试"}</th>
          <th className={resolveClasses("table-cell-time")}>{t("开始时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("结束时间")}</th>
          <th>{t("日志")}</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className={resolveClasses("id-cell")}>#{task.id}</td>
            <td
              className={resolveClasses("replication-resource")}
              title={task.extra_attrs?.artifact}
            >
              {task.extra_attrs?.artifact ?? "-"}
            </td>
            <td>
              <code title={task.extra_attrs?.digest}>
                {t(shortDigest(task.extra_attrs?.digest))}
              </code>
            </td>
            <td>{t(resourceTypeLabel(task.extra_attrs?.kind))}</td>
            <td>
              <StatusBadge status={task.status} />
            </td>
            <td>{formatNumber(task.run_count, locale)}</td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(task.start_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(task.end_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td>
              <button
                className={resolveClasses("icon-button")}
                type="button"
                title={t("查看日志")}
                aria-label={t("查看预热任务日志")}
                onClick={() => {
                  onShowLog(task);
                }}
              >
                <Icon name="history" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type PreheatExecutionTableProps = {
  executions: PreheatExecution[];
  onSelect: (execution: PreheatExecution) => void;
};

function PreheatExecutionTable({
  executions,
  onSelect,
}: PreheatExecutionTableProps) {
  const { locale, t } = useLocale();
  if (!executions.length) {
    return (
      <EmptyState
        title="暂无预热执行"
        description="手动执行或触发策略后会显示在这里。"
        icon="play"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th className={resolveClasses("id-column")}>{t("执行")}</th>
          <th>{t("触发方式")}</th>
          <th>{t("状态")}</th>
          <th>{t("任务")}</th>
          <th>{t("成功")}</th>
          <th>{t("失败")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("开始时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("耗时")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => (
          <tr key={execution.id}>
            <td className={resolveClasses("id-cell")}>#{execution.id}</td>
            <td>{t(triggerLabel(execution.trigger))}</td>
            <td>
              <StatusBadge status={execution.status} />
            </td>
            <td>{formatNumber(execution.metrics?.task_count, locale)}</td>
            <td className={resolveClasses("success-text")}>
              {formatNumber(execution.metrics?.success_task_count, locale)}
            </td>
            <td className={resolveClasses("danger-text")}>
              {formatNumber(execution.metrics?.error_task_count, locale)}
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(execution.start_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDuration(execution.start_time, execution.end_time, locale)}
            </td>
            <td>
              <button
                className={resolveClasses("button button-small")}
                type="button"
                aria-label={t("查看预热执行任务")}
                onClick={() => {
                  onSelect(execution);
                }}
              >
                <Icon name="history" />
                <span>{t("查看任务")}</span>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type PreheatExecutionsDialogProps = {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function PreheatExecutionsDialog({
  project,
  policy,
  onClose,
  onChanged,
  onNotice,
}: PreheatExecutionsDialogProps) {
  const { locale, t } = useLocale();
  const history = usePreheatExecutionHistory(project, policy.name);
  const [stopExecution, setStopExecution] = useState<PreheatExecution>();
  const selected = history.selectedExecution;
  const taskLog = useTaskLog<PreheatTask>(
    (task, signal) =>
      controlApi.data<string>(
        "preheat-task-log",
        { project, name: policy.name, id: selected?.id, task: task.id },
        signal,
      ),
    projectKeys.taskLog("preheat-log", [project, policy.name, selected?.id]),
  );

  if (stopExecution) {
    return (
      <StopPreheatExecutionDialog
        project={project}
        policy={policy}
        execution={stopExecution}
        onClose={() => {
          setStopExecution(undefined);
        }}
        onStopped={() => {
          onChanged("P2P 预热执行已停止");
        }}
      />
    );
  }

  const taskTotal = formatNumber(history.taskPagination.total, locale);
  const executionTotal = formatNumber(
    history.executionPagination.total,
    locale,
  );
  const title = (() => {
    if (selected) {
      if (locale === "en-US") {
        return `Preheat execution #${String(selected.id)}`;
      }
      return `预热执行 #${String(selected.id)}`;
    }
    if (locale === "en-US") {
      return `Preheat policy ${policy.name}`;
    }
    return `预热策略 ${policy.name}`;
  })();
  const subtitle = (() => {
    if (selected) {
      return `${t(executionStatusLabel(selected.status))} · ${locale === "en-US" ? `${taskTotal} tasks` : `${taskTotal} 个任务`}`;
    }
    if (locale === "en-US") {
      return `${executionTotal} executions`;
    }
    return `${executionTotal} 次执行`;
  })();

  function renderContent() {
    if (history.loading) {
      return (
        <DialogLoading
          message={selected ? "正在载入预热任务..." : "正在载入预热执行..."}
        />
      );
    }
    if (history.error) {
      return (
        <ErrorView
          title={selected ? "预热任务载入失败" : "预热执行记录载入失败"}
          message={history.error}
        />
      );
    }
    if (!selected) {
      return (
        <ExecutionSection
          title="预热执行记录"
          summary={
            locale === "en-US"
              ? `${executionTotal} executions`
              : `共 ${executionTotal} 次执行`
          }
        >
          <div className={resolveClasses("table-scroll")}>
            <PreheatExecutionTable
              executions={history.executions}
              onSelect={history.selectExecution}
            />
          </div>
          {history.executionPagination.total >
          history.executionPagination.page_size ? (
            <DialogPagination
              pagination={history.executionPagination}
              onPageChange={history.setExecutionPage}
            />
          ) : null}
        </ExecutionSection>
      );
    }
    return (
      <>
        <PreheatExecutionSummary
          execution={selected}
          taskTotal={history.taskPagination.total}
          onBack={() => {
            history.selectExecution(undefined);
          }}
          onStop={() => {
            setStopExecution(selected);
          }}
        />
        <ExecutionSection
          title="预热任务"
          summary={
            locale === "en-US" ? `${taskTotal} items` : `共 ${taskTotal} 项`
          }
        >
          <div
            className={resolveClasses("table-scroll replication-task-table")}
          >
            <PreheatTaskTable
              tasks={history.tasks}
              onShowLog={(task) => void taskLog.open(task)}
            />
          </div>
          {history.taskPagination.total > history.taskPagination.page_size ? (
            <DialogPagination
              pagination={history.taskPagination}
              onPageChange={history.setTaskPage}
            />
          ) : null}
        </ExecutionSection>
        <TaskLogPanel
          log={taskLog}
          executionId={selected.id}
          fileName={`harbor-preheat-${String(selected.id)}-${String(taskLog.task?.id ?? "")}.log`}
          labels={{
            refresh: "刷新预热任务日志",
            copy: "复制预热任务日志",
            download: "下载预热任务日志",
            close: "关闭预热任务日志",
            empty: "Harbor 没有返回预热任务日志。",
            nothingToDownload: "当前没有可下载的预热任务日志",
            downloaded: "预热任务日志已下载",
            region: "预热任务日志",
          }}
          onNotice={onNotice}
        />
      </>
    );
  }

  return (
    <ControlDialog
      title={title}
      subtitle={history.loading ? t("正在读取执行记录") : subtitle}
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
      {renderContent()}
    </ControlDialog>
  );
}

type StopPreheatExecutionDialogProps = {
  project: string;
  policy: PreheatPolicy;
  execution: PreheatExecution;
  onClose: () => void;
  onStopped: () => void;
};

function StopPreheatExecutionDialog({
  project,
  policy,
  execution,
  onClose,
  onStopped,
}: StopPreheatExecutionDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="停止 P2P 预热执行"
      subtitle={
        locale === "en-US"
          ? `Execution #${String(execution.id)}`
          : `执行 #${String(execution.id)}`
      }
      submitLabel="停止执行"
      submitIcon="x"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "preheat-execution",
          parameters: { project, name: policy.name, id: execution.id },
          method: "PATCH",
          payload: { status: "Stopped" },
        });
        onStopped();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>
          {t("已经完成的预热任务不会回滚，运行中的任务将由 Harbor 请求停止。")}
        </span>
      </div>
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
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-danger": uiStyles0.buttonDanger,
  "id-column": uiStyles0.idColumn,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  "replication-resource": uiStyles0.replicationResource,
  "icon-button": uiStyles0.iconButton,
  "success-text": uiStyles0.successText,
  "danger-text": uiStyles0.dangerText,
  "table-scroll": uiStyles0.tableScroll,
  "replication-task-table": uiStyles0.replicationTaskTable,
  "control-dialog-wide": uiStyles0.controlDialogWide,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
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
