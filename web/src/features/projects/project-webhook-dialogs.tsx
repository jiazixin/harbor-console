import { useEffect, useMemo, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  ProjectWebhook,
  WebhookEventMetadata,
  WebhookExecution,
  WebhookTask,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { DialogPagination } from "./dialog-pagination";
import { Icon } from "../../components/icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";

const fallbackEvents = [
  "PUSH_ARTIFACT",
  "PULL_ARTIFACT",
  "DELETE_ARTIFACT",
  "SCANNING_COMPLETED",
  "SCANNING_FAILED",
];
const defaultEvents = new Set(["PUSH_ARTIFACT", "SCANNING_COMPLETED"]);

const eventLabels: Record<string, string> = {
  PUSH_ARTIFACT: "推送制品",
  PULL_ARTIFACT: "拉取制品",
  DELETE_ARTIFACT: "删除制品",
  SCANNING_COMPLETED: "扫描完成",
  SCANNING_FAILED: "扫描失败",
  QUOTA_EXCEED: "配额超限",
  TAG_RETENTION: "Tag 保留执行",
};

function webhookEventLabel(value: string): string {
  return eventLabels[value] ?? value;
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

function emptyPagination(pageSize = 20): ControlPagination {
  return { page: 1, page_size: pageSize, total: 0 };
}

export function ProjectWebhookDialog({
  project,
  webhook,
  metadata,
  onClose,
  onSaved,
}: {
  project: string;
  webhook?: ProjectWebhook;
  metadata: WebhookEventMetadata;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const target = webhook?.targets?.[0];
  const events = metadata.event_type?.length
    ? metadata.event_type
    : fallbackEvents;
  const payloadFormats = metadata.payload_formats?.find(
    (item) => item.notify_type === "http",
  )?.formats ?? ["Default", "CloudEvents"];
  const defaultPayloadFormat = payloadFormats.at(0) ?? "Default";
  const [name, setName] = useState(webhook?.name ?? "");
  const [description, setDescription] = useState(webhook?.description ?? "");
  const [address, setAddress] = useState(target?.address ?? "");
  const [authHeader, setAuthHeader] = useState(target?.auth_header ?? "");
  const [payloadFormat, setPayloadFormat] = useState(
    target?.payload_format ?? defaultPayloadFormat,
  );
  const [enabled, setEnabled] = useState(webhook?.enabled !== false);
  const [skipCertificateVerification, setSkipCertificateVerification] =
    useState(target?.skip_cert_verify === true);
  const [selectedEvents, setSelectedEvents] = useState(
    () =>
      new Set(
        webhook?.event_types?.length
          ? webhook.event_types.filter((eventName) =>
              events.includes(eventName),
            )
          : events.filter((eventName) => defaultEvents.has(eventName)),
      ),
  );

  return (
    <ControlDialog
      title={webhook ? "编辑 Webhook" : "新建 Webhook"}
      subtitle={project}
      submitLabel={webhook ? "保存 Webhook" : "创建 Webhook"}
      onClose={onClose}
      onSubmit={async () => {
        if (!selectedEvents.size) {
          throw new Error(t("请至少选择一种事件类型"));
        }
        const payload = {
          name: name.trim(),
          description: description.trim(),
          enabled,
          event_types: Array.from(selectedEvents),
          targets: [
            {
              type: "http",
              address: address.trim(),
              auth_header: authHeader,
              skip_cert_verify: skipCertificateVerification,
              payload_format: payloadFormat,
            },
          ],
        };
        await controlApi.mutate(
          webhook ? "webhook" : "webhooks",
          webhook ? { project, id: webhook.id } : { project },
          webhook ? "PUT" : "POST",
          payload,
        );
        onSaved();
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("名称")}</span>
          <input
            name="name"
            required
            maxLength={255}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("负载格式")}</span>
          <UnifiedSelect
            ariaLabel={t("负载格式")}
            name="payload_format"
            value={payloadFormat}
            options={payloadFormats.map((format) => ({
              value: format,
              label: format,
            }))}
            onChange={setPayloadFormat}
          />
        </label>
        <label className="field field-span">
          <span>{t("目标地址")}</span>
          <input
            name="address"
            type="url"
            required
            value={address}
            placeholder="https://hooks.example.com/harbor"
            onChange={(event) => setAddress(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("Authorization 请求头")}</span>
          <input
            name="auth_header"
            value={authHeader}
            autoComplete="off"
            placeholder={t("可选")}
            onChange={(event) => setAuthHeader(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <input
            name="description"
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
      <fieldset className="event-selector">
        <legend>{t("事件类型")}</legend>
        {events.map((eventName) => (
          <label className="check-row" key={eventName}>
            <input
              type="checkbox"
              checked={selectedEvents.has(eventName)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setSelectedEvents((current) => {
                  const next = new Set(current);
                  if (checked) next.add(eventName);
                  else next.delete(eventName);
                  return next;
                });
              }}
            />
            <span>
              <strong>{t(webhookEventLabel(eventName))}</strong>
              <small>{eventName}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="check-grid">
        <label className="check-row">
          <input
            name="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("启用 Webhook")}</strong>
          </span>
        </label>
        <label className="check-row">
          <input
            name="skip_cert_verify"
            type="checkbox"
            checked={skipCertificateVerification}
            onChange={(event) =>
              setSkipCertificateVerification(event.currentTarget.checked)
            }
          />
          <span>
            <strong>{t("跳过 TLS 验证")}</strong>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

export function DeleteProjectWebhookDialog({
  project,
  webhook,
  onClose,
  onDeleted,
}: {
  project: string;
  webhook: ProjectWebhook;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Webhook ${webhook.name} will stop sending events.`
      : `Webhook ${webhook.name} 将停止发送事件。`;
  return (
    <ControlDialog
      title="删除 Webhook"
      subtitle={subtitle}
      submitLabel="删除 Webhook"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "webhook",
          { project, id: webhook.id },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}

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
  const requestVersion = useRef(0);
  const logRequestController = useRef<AbortController | undefined>(undefined);
  const logViewRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState("");
  const [executionPage, setExecutionPage] = useState(1);
  const [executions, setExecutions] = useState<WebhookExecution[]>([]);
  const [executionPagination, setExecutionPagination] =
    useState(emptyPagination());
  const [selectedExecution, setSelectedExecution] =
    useState<WebhookExecution>();
  const [taskPage, setTaskPage] = useState(1);
  const [tasks, setTasks] = useState<WebhookTask[]>([]);
  const [taskPagination, setTaskPagination] = useState(emptyPagination());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<WebhookTask>();
  const [taskLog, setTaskLog] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [timezone, setTimezone] = useState<LogTimezone>("local");

  useEffect(
    () => () => {
      requestVersion.current += 1;
      logRequestController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!selectedTask || logLoading) return;
    logViewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    logViewRef.current?.focus({ preventScroll: true });
  }, [logLoading, selectedTask]);

  useEffect(() => {
    if (selectedExecution) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void controlApi
      .list<WebhookExecution>(
        "webhook-executions",
        {
          project,
          id: webhook.id,
          page: executionPage,
          page_size: 20,
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
  }, [executionPage, project, selectedExecution, status, webhook.id]);

  useEffect(() => {
    if (!selectedExecution) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void controlApi
      .list<WebhookTask>(
        "webhook-tasks",
        {
          project,
          id: webhook.id,
          execution: selectedExecution.id,
          page: taskPage,
          page_size: 20,
          sort: "-start_time",
        },
        controller.signal,
      )
      .then((collection) => {
        setTasks(collection.items);
        setTaskPagination(collection.pagination);
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
  }, [project, selectedExecution, taskPage, webhook.id]);

  async function loadTaskLog(task: WebhookTask) {
    logRequestController.current?.abort();
    const controller = new AbortController();
    logRequestController.current = controller;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setSelectedTask(task);
    setLogLoading(true);
    try {
      const value = await controlApi.data<string>(
        "webhook-task-log",
        {
          project,
          id: webhook.id,
          execution: selectedExecution?.id,
          task: task.id,
        },
        controller.signal,
      );
      if (requestVersion.current === version) setTaskLog(value ?? "");
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }
      if (requestVersion.current === version) {
        setTaskLog(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    } finally {
      if (requestVersion.current === version) setLogLoading(false);
    }
  }

  async function copyTaskLog() {
    try {
      await navigator.clipboard.writeText(taskLog);
      onNotice("已复制到剪贴板");
    } catch {
      onNotice("无法写入剪贴板", true);
    }
  }

  const statusOptions = useMemo(
    () =>
      [
        { value: "", label: t("全部状态") },
        { value: "Success", label: t("成功") },
        { value: "Error", label: t("异常") },
        { value: "Running", label: t("运行中") },
        { value: "Pending", label: t("等待中") },
        { value: "Stopped", label: t("已停止") },
      ] as const,
    [t],
  );

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
      {loading ? (
        <div className="dialog-loading" role="status">
          <span className="spinner" />
          <span>
            {t(
              selectedExecution
                ? "正在载入 Webhook 任务..."
                : "正在载入 Webhook 执行记录...",
            )}
          </span>
        </div>
      ) : error ? (
        <div className="empty-table permission-table">
          <strong>
            {t(
              selectedExecution
                ? "Webhook 任务载入失败"
                : "Webhook 执行历史载入失败",
            )}
          </strong>
          <span>{error}</span>
        </div>
      ) : selectedExecution ? (
        <>
          <section className="execution-summary">
            <div className="execution-summary-head">
              <div>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => {
                    setSelectedExecution(undefined);
                    setSelectedTask(undefined);
                    setTaskLog("");
                  }}
                >
                  <Icon name="chevron-left" />
                  <span>{t("执行历史")}</span>
                </button>
                <StatusBadge status={selectedExecution.status} />
                <span>{executionEvent(selectedExecution)}</span>
                <span>{formatDate(selectedExecution.start_time, locale)}</span>
              </div>
            </div>
            <dl className="execution-stats">
              {[
                {
                  label: "总任务",
                  value:
                    selectedExecution.metrics?.task_count ??
                    taskPagination.total,
                },
                {
                  label: "成功",
                  value: selectedExecution.metrics?.success_task_count,
                  className: "success-text",
                },
                {
                  label: "失败",
                  value: selectedExecution.metrics?.error_task_count,
                  className: "danger-text",
                },
                {
                  label: "进行中",
                  value: selectedExecution.metrics?.running_task_count,
                },
                {
                  label: "已停止",
                  value: selectedExecution.metrics?.stopped_task_count,
                },
              ].map(({ label, value, className }) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd className={className}>{formatNumber(value, locale)}</dd>
                </div>
              ))}
              <div>
                <dt>{t("耗时")}</dt>
                <dd>
                  {formatDuration(
                    selectedExecution.start_time,
                    selectedExecution.end_time,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="replication-task-section">
            <div className="section-heading compact-heading">
              <div>
                <h3>{t("Webhook 任务")}</h3>
                <p>
                  {locale === "en-US"
                    ? `${formatNumber(taskPagination.total, locale)} items`
                    : `共 ${formatNumber(taskPagination.total, locale)} 项`}
                </p>
              </div>
            </div>
            <div className="table-scroll replication-task-table">
              {!tasks.length ? (
                <div className="empty-table">
                  <strong>{t("暂无 Webhook 任务")}</strong>
                  <span>{t("该执行记录还没有返回任务明细。")}</span>
                </div>
              ) : (
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
                            onClick={() => void loadTaskLog(task)}
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
              pagination={taskPagination}
              onPageChange={setTaskPage}
            />
          </section>
          {selectedTask ? (
            <section
              ref={logViewRef}
              className="replication-log-view"
              tabIndex={-1}
            >
              <header>
                <div>
                  <h3>{t("任务日志")}</h3>
                  <p>
                    {locale === "en-US"
                      ? `Execution #${String(selectedExecution.id)} · Task #${String(selectedTask.id)}`
                      : `执行 #${String(selectedExecution.id)} · 任务 #${String(selectedTask.id)}`}
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
                    aria-label={t("刷新 Webhook 任务日志")}
                    onClick={() => void loadTaskLog(selectedTask)}
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("复制日志")}
                    aria-label={t("复制 Webhook 任务日志")}
                    onClick={() => void copyTaskLog()}
                  >
                    <Icon name="copy" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("下载日志")}
                    aria-label={t("下载 Webhook 任务日志")}
                    onClick={() => {
                      if (!taskLog) {
                        onNotice("当前没有可下载的 Webhook 任务日志", true);
                        return;
                      }
                      downloadText(
                        taskLog,
                        `harbor-webhook-${String(selectedExecution.id)}-${String(selectedTask.id)}.log`,
                      );
                      onNotice("Webhook 任务日志已下载");
                    }}
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("关闭日志")}
                    aria-label={t("关闭 Webhook 任务日志")}
                    onClick={() => {
                      requestVersion.current += 1;
                      logRequestController.current?.abort();
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
                emptyMessage="Harbor 没有返回 Webhook 任务日志。"
              />
            </section>
          ) : null}
        </>
      ) : (
        <section className="dialog-table-section">
          <div className="table-toolbar">
            <strong>{t("执行记录")}</strong>
            <div className="toolbar-spacer" />
            <label className="compact-field">
              <span>{t("状态")}</span>
              <UnifiedSelect
                ariaLabel={t("状态")}
                value={status}
                options={[...statusOptions]}
                onChange={(next) => {
                  setStatus(next);
                  setExecutionPage(1);
                }}
              />
            </label>
          </div>
          <div className="table-scroll">
            {!executions.length ? (
              <div className="empty-table">
                <strong>{t("暂无执行记录")}</strong>
                <span>{t("当前筛选条件下没有 Webhook 执行记录。")}</span>
              </div>
            ) : (
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
                      <td>
                        {formatNumber(execution.metrics?.task_count, locale)}
                      </td>
                      <td>
                        <StatusBadge status={execution.status} />
                      </td>
                      <td className="table-cell-time">
                        {formatDate(execution.start_time, locale)}
                      </td>
                      <td className="table-cell-time">
                        {formatDuration(
                          execution.start_time,
                          execution.end_time,
                          locale,
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          type="button"
                          title={t("查看任务")}
                          aria-label={t("查看 Webhook 执行任务")}
                          onClick={() => {
                            setTaskPage(1);
                            setSelectedTask(undefined);
                            setTaskLog("");
                            setSelectedExecution(execution);
                          }}
                        >
                          <Icon name="external" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogPagination
            pagination={executionPagination}
            onPageChange={setExecutionPage}
          />
        </section>
      )}
    </ControlDialog>
  );
}
