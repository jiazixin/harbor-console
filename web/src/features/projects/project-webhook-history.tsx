import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  ProjectWebhook,
  WebhookExecution,
  WebhookTask,
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
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatusBadge } from "../../components/status-badge";
import { triggerLabel } from "../../components/status-badge-support";
import { TaskLogPanel } from "../../components/task-log-panel";
import { UnifiedSelect } from "../../components/unified-select";
import { useTaskLog } from "../../components/use-task-log";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatDate,
  formatDuration,
  formatNumber,
} from "../../lib/format/formatters";
import { DialogPagination } from "./dialog-pagination";
import { projectKeys } from "./project-keys";
import styles from "./projects.module.css";

const historyPageSize = 20;

function emptyPagination(): ControlPagination {
  return { page: 1, page_size: historyPageSize, total: 0 };
}

function executionEvent(execution: WebhookExecution): string {
  const candidates = [
    execution.extra_attrs?.event_type,
    execution.extra_attrs?.EventType,
    execution.vendor_type,
  ];
  return candidates.find((value) => value?.trim()) ?? "Webhook";
}

function displayText(value: string | undefined): string {
  return value?.trim() ? value : "-";
}

/** Loads the webhook's executions, or the tasks of the selected execution. */
function useWebhookHistory(project: string, webhookId: number) {
  const [status, setStatus] = useState("");
  const [executionPage, setExecutionPage] = useState(1);
  const [selectedExecution, setSelectedExecution] =
    useState<WebhookExecution>();
  const [taskPage, setTaskPage] = useState(1);
  const selectedExecutionId = selectedExecution?.id;
  const executionsQuery = useLoadedQuery(
    projectKeys.webhookHistory({ project, webhookId, status, executionPage }),
    (signal) =>
      controlApi.list<WebhookExecution>(
        "webhook-executions",
        {
          project,
          id: webhookId,
          page: executionPage,
          page_size: historyPageSize,
          sort: "-start_time",
          q: status ? `status=${status}` : "",
        },
        signal,
      ),
    { enabled: selectedExecutionId === undefined },
  );
  const tasksQuery = useLoadedQuery(
    projectKeys.webhookHistory({
      project,
      webhookId,
      execution: selectedExecutionId,
      taskPage,
    }),
    (signal) =>
      controlApi.list<WebhookTask>(
        "webhook-tasks",
        {
          project,
          id: webhookId,
          // Enabled only with a selection, so the fallback is never sent.
          execution: selectedExecutionId ?? 0,
          page: taskPage,
          page_size: historyPageSize,
          sort: "-start_time",
        },
        signal,
      ),
    { enabled: selectedExecutionId !== undefined },
  );
  const activeQuery =
    selectedExecutionId === undefined ? executionsQuery : tasksQuery;

  return {
    status,
    filterStatus: (next: string) => {
      setStatus(next);
      setExecutionPage(1);
    },
    executions: executionsQuery.data?.items ?? [],
    executionPagination: executionsQuery.data?.pagination ?? emptyPagination(),
    setExecutionPage,
    selectedExecution,
    selectExecution: (execution: WebhookExecution | undefined) => {
      setTaskPage(1);
      setSelectedExecution(execution);
    },
    tasks: tasksQuery.data?.items ?? [],
    taskPagination: tasksQuery.data?.pagination ?? emptyPagination(),
    setTaskPage,
    loading: activeQuery.loading,
    error: activeQuery.error,
  };
}

type WebhookTaskTableProps = {
  tasks: WebhookTask[];
  onShowLog: (task: WebhookTask) => void;
};

function WebhookTaskTable({ tasks, onShowLog }: WebhookTaskTableProps) {
  const { locale, t } = useLocale();
  if (!tasks.length) {
    return (
      <EmptyState
        title="暂无 Webhook 任务"
        description="该执行记录还没有返回任务明细。"
        icon="refresh"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th className={resolveClasses("id-column")}>{t("任务")}</th>
          <th>{t("事件")}</th>
          <th>{t("资源")}</th>
          <th>{t("目标")}</th>
          <th>{t("尝试次数")}</th>
          <th>{t("状态")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("开始时间")}</th>
          <th>{t("日志")}</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className={resolveClasses("id-cell")}>#{task.id}</td>
            <td>{displayText(task.extra_attrs?.event_type)}</td>
            <td className={resolveClasses("truncate-cell mono")}>
              {displayText(task.extra_attrs?.resource)}
            </td>
            <td className={resolveClasses("truncate-cell mono")}>
              {displayText(task.extra_attrs?.destination)}
            </td>
            <td>{formatNumber(task.run_count, locale)}</td>
            <td>
              <StatusBadge status={task.status} />
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(task.start_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td>
              <button
                className={resolveClasses("icon-button")}
                type="button"
                title={t("查看日志")}
                aria-label={t("查看 Webhook 任务日志")}
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

type WebhookExecutionTableProps = {
  executions: WebhookExecution[];
  onSelect: (execution: WebhookExecution) => void;
};

function WebhookExecutionTable({
  executions,
  onSelect,
}: WebhookExecutionTableProps) {
  const { locale, t } = useLocale();
  if (!executions.length) {
    return (
      <EmptyState
        title="暂无执行记录"
        description="当前筛选条件下没有 Webhook 执行记录。"
        icon="history"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th className={resolveClasses("id-column")}>{t("执行")}</th>
          <th>{t("事件")}</th>
          <th>{t("触发方式")}</th>
          <th>{t("任务")}</th>
          <th>{t("状态")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("开始时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("耗时")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => (
          <tr key={execution.id}>
            <td className={resolveClasses("id-cell")}>#{execution.id}</td>
            <td>
              <span className={resolveClasses("badge badge-blue")}>
                {executionEvent(execution)}
              </span>
            </td>
            <td>{triggerLabel(execution.trigger, t)}</td>
            <td>{formatNumber(execution.metrics?.task_count, locale)}</td>
            <td>
              <StatusBadge status={execution.status} />
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
                className={resolveClasses("icon-button")}
                type="button"
                title={t("查看任务")}
                aria-label={t("查看 Webhook 执行任务")}
                onClick={() => {
                  onSelect(execution);
                }}
              >
                <Icon name="external" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const statusFilters = [
  { value: "", label: "全部状态" },
  { value: "Success", label: "成功" },
  { value: "Error", label: "异常" },
  { value: "Running", label: "运行中" },
  { value: "Pending", label: "等待中" },
  { value: "Stopped", label: "已停止" },
] as const;

type WebhookHistoryDialogProps = {
  project: string;
  webhook: ProjectWebhook;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function WebhookHistoryDialog({
  project,
  webhook,
  onClose,
  onNotice,
}: WebhookHistoryDialogProps) {
  const { locale, t } = useLocale();
  const history = useWebhookHistory(project, webhook.id);
  const selected = history.selectedExecution;
  const taskLog = useTaskLog<WebhookTask>(
    (task, signal) =>
      controlApi.data<string>(
        "webhook-task-log",
        { project, id: webhook.id, execution: selected?.id, task: task.id },
        signal,
      ),
    projectKeys.taskLog("webhook-log", [project, webhook.id, selected?.id]),
  );

  function renderContent() {
    if (history.loading) {
      return (
        <DialogLoading
          message={
            selected
              ? "正在载入 Webhook 任务..."
              : "正在载入 Webhook 执行记录..."
          }
        />
      );
    }
    if (history.error) {
      return (
        <ErrorView
          title={selected ? "Webhook 任务载入失败" : "Webhook 执行历史载入失败"}
          message={history.error}
        />
      );
    }
    if (!selected) {
      return (
        <section className={resolveClasses("dialog-table-section")}>
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle title="执行记录" />
            <div className={resolveClasses("toolbar-spacer")} />
            <label className={resolveClasses(styles.compactField)}>
              <span>{t("状态")}</span>
              <UnifiedSelect
                ariaLabel={t("状态")}
                value={history.status}
                options={statusFilters.map(({ value, label }) => ({
                  value,
                  label: t(label),
                }))}
                onChange={history.filterStatus}
              />
            </label>
          </div>
          <div className={resolveClasses("table-scroll")}>
            <WebhookExecutionTable
              executions={history.executions}
              onSelect={history.selectExecution}
            />
          </div>
          <DialogPagination
            pagination={history.executionPagination}
            onPageChange={history.setExecutionPage}
          />
        </section>
      );
    }
    const metrics = selected.metrics;
    const taskTotal = history.taskPagination.total;
    return (
      <>
        <ExecutionSummary
          status={selected.status}
          leading={
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => {
                history.selectExecution(undefined);
              }}
            >
              <Icon name="chevron-left" />
              <span>{t("执行历史")}</span>
            </button>
          }
          details={[
            executionEvent(selected),
            formatDate(selected.start_time, {
              locale: locale,
              timeZone: displayTimeZone(),
            }),
          ]}
          stats={[
            { label: "总任务", value: metrics?.task_count ?? taskTotal },
            {
              label: "成功",
              value: metrics?.success_task_count,
              tone: "success",
            },
            { label: "失败", value: metrics?.error_task_count, tone: "danger" },
            { label: "进行中", value: metrics?.running_task_count },
            { label: "已停止", value: metrics?.stopped_task_count },
          ]}
          startTime={selected.start_time}
          endTime={selected.end_time}
          statusMessage={selected.status_message}
        />
        <ExecutionSection
          title="Webhook 任务"
          summary={
            locale === "en-US"
              ? `${formatNumber(taskTotal, locale)} items`
              : `共 ${formatNumber(taskTotal, locale)} 项`
          }
        >
          <div
            className={resolveClasses("table-scroll replication-task-table")}
          >
            <WebhookTaskTable
              tasks={history.tasks}
              onShowLog={(task) => void taskLog.open(task)}
            />
          </div>
          <DialogPagination
            pagination={history.taskPagination}
            onPageChange={history.setTaskPage}
          />
        </ExecutionSection>
        <TaskLogPanel
          log={taskLog}
          executionId={selected.id}
          fileName={`harbor-webhook-${String(selected.id)}-${String(taskLog.task?.id ?? "")}.log`}
          labels={{
            refresh: "刷新 Webhook 任务日志",
            copy: "复制 Webhook 任务日志",
            download: "下载 Webhook 任务日志",
            close: "关闭 Webhook 任务日志",
            empty: "Harbor 没有返回 Webhook 任务日志。",
            nothingToDownload: "当前没有可下载的 Webhook 任务日志",
            downloaded: "Webhook 任务日志已下载",
          }}
          onNotice={onNotice}
        />
      </>
    );
  }

  return (
    <ControlDialog
      title="Webhook 执行历史"
      subtitle={webhook.name}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass={resolveClasses("control-dialog-wide")}
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={onClose}
    >
      {renderContent()}
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "dialog-loading": uiStyles0.dialogLoading,
  "empty-state": uiStyles0.emptyState,
  "execution-summary": uiStyles0.executionSummary,
  icon: uiStyles0.icon,
  "panel-title": uiStyles0.panelTitle,
  "status-badge": uiStyles0.statusBadge,
  "unified-select": uiStyles0.unifiedSelect,
  "id-column": uiStyles0.idColumn,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  "truncate-cell": uiStyles0.truncateCell,
  mono: uiStyles0.mono,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  "table-scroll": uiStyles0.tableScroll,
  "button-small": uiStyles0.buttonSmall,
  "replication-task-table": uiStyles0.replicationTaskTable,
  "control-dialog-wide": uiStyles0.controlDialogWide,
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
