import { useEffect, useState } from "react";

import { controlApi } from "../../app/api-client";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  ProjectWebhook,
  WebhookExecution,
  WebhookTask,
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
import { PanelTitle } from "../../components/page-elements";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { TaskLogPanel, useTaskLog } from "../../components/task-log-panel";
import { UnifiedSelect } from "../../components/unified-select";
import { DialogPagination } from "./dialog-pagination";

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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Loads the webhook's executions, or the tasks of the selected execution. */
function useWebhookHistory(project: string, webhookId: number) {
  const [status, setStatus] = useState("");
  const [executionPage, setExecutionPage] = useState(1);
  const [executions, setExecutions] = useState<WebhookExecution[]>([]);
  const [executionPagination, setExecutionPagination] =
    useState(emptyPagination);
  const [selectedExecution, setSelectedExecution] =
    useState<WebhookExecution>();
  const [taskPage, setTaskPage] = useState(1);
  const [tasks, setTasks] = useState<WebhookTask[]>([]);
  const [taskPagination, setTaskPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedExecutionId = selectedExecution?.id;

  useEffect(() => {
    if (selectedExecutionId !== undefined) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void controlApi
      .list<WebhookExecution>(
        "webhook-executions",
        {
          project,
          id: webhookId,
          page: executionPage,
          page_size: historyPageSize,
          sort: "-start_time",
          q: status ? `status=${status}` : "",
        },
        controller.signal,
      )
      .then((collection) => {
        setExecutions(collection.items);
        setExecutionPagination(collection.pagination);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) setError(errorText(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [executionPage, project, selectedExecutionId, status, webhookId]);

  useEffect(() => {
    if (selectedExecutionId === undefined) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void controlApi
      .list<WebhookTask>(
        "webhook-tasks",
        {
          project,
          id: webhookId,
          execution: selectedExecutionId,
          page: taskPage,
          page_size: historyPageSize,
          sort: "-start_time",
        },
        controller.signal,
      )
      .then((collection) => {
        setTasks(collection.items);
        setTaskPagination(collection.pagination);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) setError(errorText(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [project, selectedExecutionId, taskPage, webhookId]);

  return {
    status,
    filterStatus: (next: string) => {
      setStatus(next);
      setExecutionPage(1);
    },
    executions,
    executionPagination,
    setExecutionPage,
    selectedExecution,
    selectExecution: (execution: WebhookExecution | undefined) => {
      setTaskPage(1);
      setSelectedExecution(execution);
    },
    tasks,
    taskPagination,
    setTaskPage,
    loading,
    error,
  };
}

function WebhookTaskTable({
  tasks,
  onShowLog,
}: {
  tasks: WebhookTask[];
  onShowLog: (task: WebhookTask) => void;
}) {
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
          <th className="id-column">{t("任务")}</th>
          <th>{t("事件")}</th>
          <th>{t("资源")}</th>
          <th>{t("目标")}</th>
          <th>{t("尝试次数")}</th>
          <th>{t("状态")}</th>
          <th className="table-cell-time">{t("开始时间")}</th>
          <th>{t("日志")}</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className="id-cell">#{task.id}</td>
            <td>{displayText(task.extra_attrs?.event_type)}</td>
            <td className="truncate-cell mono">
              {displayText(task.extra_attrs?.resource)}
            </td>
            <td className="truncate-cell mono">
              {displayText(task.extra_attrs?.destination)}
            </td>
            <td>{formatNumber(task.run_count, locale)}</td>
            <td>
              <StatusBadge status={task.status} />
            </td>
            <td className="table-cell-time">
              {formatDate(task.start_time, locale)}
            </td>
            <td>
              <button
                className="icon-button"
                type="button"
                title={t("查看日志")}
                aria-label={t("查看 Webhook 任务日志")}
                onClick={() => onShowLog(task)}
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

function WebhookExecutionTable({
  executions,
  onSelect,
}: {
  executions: WebhookExecution[];
  onSelect: (execution: WebhookExecution) => void;
}) {
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
          <th className="id-column">{t("执行")}</th>
          <th>{t("事件")}</th>
          <th>{t("触发方式")}</th>
          <th>{t("任务")}</th>
          <th>{t("状态")}</th>
          <th className="table-cell-time">{t("开始时间")}</th>
          <th className="table-cell-time">{t("耗时")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => (
          <tr key={execution.id}>
            <td className="id-cell">#{execution.id}</td>
            <td>
              <span className="badge badge-blue">
                {executionEvent(execution)}
              </span>
            </td>
            <td>{triggerLabel(execution.trigger, t)}</td>
            <td>{formatNumber(execution.metrics?.task_count, locale)}</td>
            <td>
              <StatusBadge status={execution.status} />
            </td>
            <td className="table-cell-time">
              {formatDate(execution.start_time, locale)}
            </td>
            <td className="table-cell-time">
              {formatDuration(execution.start_time, execution.end_time, locale)}
            </td>
            <td>
              <button
                className="icon-button"
                type="button"
                title={t("查看任务")}
                aria-label={t("查看 Webhook 执行任务")}
                onClick={() => onSelect(execution)}
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

export function WebhookHistoryDialog({
  project,
  webhook,
  onClose,
  onNotice,
}: {
  project: string;
  webhook: ProjectWebhook;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const history = useWebhookHistory(project, webhook.id);
  const selected = history.selectedExecution;
  const taskLog = useTaskLog<WebhookTask>((task, signal) =>
    controlApi.data<string>(
      "webhook-task-log",
      { project, id: webhook.id, execution: selected?.id, task: task.id },
      signal,
    ),
  );
  const { close: closeTaskLog } = taskLog;

  // A log belongs to one execution; selecting another execution closes it.
  useEffect(() => {
    closeTaskLog();
  }, [closeTaskLog, selected?.id]);

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
        <section className="dialog-table-section">
          <div className="table-toolbar">
            <PanelTitle title="执行记录" />
            <div className="toolbar-spacer" />
            <label className="compact-field">
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
          <div className="table-scroll">
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
              className="button button-small"
              type="button"
              onClick={() => history.selectExecution(undefined)}
            >
              <Icon name="chevron-left" />
              <span>{t("执行历史")}</span>
            </button>
          }
          details={[
            executionEvent(selected),
            formatDate(selected.start_time, locale),
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
          <div className="table-scroll replication-task-table">
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
      dialogClass="control-dialog-wide"
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => Promise.resolve(onClose())}
    >
      {renderContent()}
    </ControlDialog>
  );
}
