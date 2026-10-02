import { useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  PreheatExecution,
  PreheatFilter,
  PreheatPolicy,
  PreheatProvider,
  PreheatTask,
  PreheatTrigger,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { DialogPagination } from "./dialog-pagination";
import { Icon } from "../../components/icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import { StatusBadge } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";

function parseJson<T>(value: string | T | undefined, fallback: T): T {
  if (value !== undefined && typeof value !== "string") return value;
  try {
    return JSON.parse(typeof value === "string" ? value : "") as T;
  } catch {
    return fallback;
  }
}

function filterValue(
  policy: PreheatPolicy | undefined,
  type: string,
  fallback = "",
) {
  const value = parseJson<PreheatFilter[]>(policy?.filters, []).find(
    (filter) => filter.type === type,
  )?.value;
  const text = value ?? fallback;
  return /^\{.*\}$/.test(text) ? text.slice(1, -1) : text;
}

function patternValue(value: string): string {
  const normalized = value.trim();
  return normalized.includes(",") && !/^\{.*\}$/.test(normalized)
    ? `{${normalized}}`
    : normalized;
}

function stringField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function policyPayload(
  projectId: number,
  policy: PreheatPolicy | undefined,
  fields: {
    providerId: string;
    name: string;
    description: string;
    repository: string;
    tag: string;
    label: string;
    triggerType: string;
    cron: string;
    scope: string;
    clusterIds: string;
    enabled: boolean;
  },
) {
  const filters: PreheatFilter[] = [
    { type: "repository", value: patternValue(fields.repository) },
    { type: "tag", value: patternValue(fields.tag) },
  ];
  const label = patternValue(fields.label);
  if (label) filters.push({ type: "label", value: label });
  const extra: Record<string, unknown> = {};
  if (fields.scope) extra.scope = fields.scope;
  const clusterIds = fields.clusterIds
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (clusterIds.length) extra.cluster_ids = clusterIds;
  return {
    ...(policy?.id ? { id: policy.id } : {}),
    name: fields.name.trim(),
    description: fields.description.trim(),
    project_id: projectId,
    provider_id: Number(fields.providerId),
    filters: JSON.stringify(filters),
    trigger: JSON.stringify({
      type: fields.triggerType,
      trigger_setting: {
        cron: fields.triggerType === "scheduled" ? fields.cron.trim() : "",
      },
    }),
    enabled: fields.enabled,
    ...(Object.keys(extra).length
      ? { extra_attrs: JSON.stringify(extra) }
      : {}),
  };
}

function runnablePolicyPayload(policy: PreheatPolicy) {
  const payload: Record<string, unknown> = {
    name: policy.name,
    description: policy.description ?? "",
    project_id: policy.project_id ?? 0,
    provider_id: policy.provider_id ?? 0,
    filters:
      typeof policy.filters === "string"
        ? policy.filters
        : JSON.stringify(policy.filters ?? []),
    trigger:
      typeof policy.trigger === "string"
        ? policy.trigger
        : JSON.stringify(policy.trigger ?? {}),
    enabled: policy.enabled !== false,
  };
  if (policy.id > 0) payload.id = policy.id;
  if (typeof policy.extra_attrs === "string" && policy.extra_attrs.trim()) {
    payload.extra_attrs = policy.extra_attrs;
  } else if (policy.extra_attrs && typeof policy.extra_attrs === "object") {
    payload.extra_attrs = JSON.stringify(policy.extra_attrs);
  }
  return payload;
}

function emptyPagination(): ControlPagination {
  return { page: 1, page_size: 100, total: 0 };
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
  if (["running", "inprogress", "in_progress"].includes(normalized))
    return "运行中";
  if (["pending", "queued"].includes(normalized)) return "等待中";
  if (normalized === "scheduled") return "已计划";
  if (["failed", "error"].includes(normalized)) return "失败";
  if (normalized === "stopped") return "已停止";
  if (normalized === "completed") return "已完成";
  return status ?? "未知";
}

function resourceTypeText(
  value: string | undefined,
  locale: "zh-CN" | "en-US",
): string {
  const label = resourceTypeLabel(value);
  if (locale === "en-US" && label === "镜像") return "Images";
  return label;
}

export function PreheatPolicyDialog({
  project,
  projectId,
  providers,
  policy,
  onClose,
  onSaved,
}: {
  project: string;
  projectId: number;
  providers: PreheatProvider[];
  policy?: PreheatPolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useLocale();
  const trigger = parseJson<PreheatTrigger>(policy?.trigger, {
    type: "manual",
    trigger_setting: { cron: "" },
  });
  const extra = parseJson<Record<string, unknown>>(policy?.extra_attrs, {});
  const defaultProvider =
    policy?.provider_id ??
    providers.find((provider) => provider.default)?.id ??
    providers[0]?.id;
  const [providerId, setProviderId] = useState(String(defaultProvider));
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [repository, setRepository] = useState(
    filterValue(policy, "repository", "**"),
  );
  const [tag, setTag] = useState(filterValue(policy, "tag", "**"));
  const [label, setLabel] = useState(filterValue(policy, "label"));
  const [triggerType, setTriggerType] = useState(trigger.type ?? "manual");
  const [cron, setCron] = useState(
    trigger.trigger_setting?.cron ?? "0 0 2 * * *",
  );
  const [scope, setScope] = useState(
    stringField(extra.scope, "single_seed_peer"),
  );
  const [clusterIds, setClusterIds] = useState(
    Array.isArray(extra.cluster_ids) ? extra.cluster_ids.join(",") : "",
  );
  const [enabled, setEnabled] = useState(policy?.enabled !== false);
  const selectedProvider = providers.find(
    (provider) => String(provider.id) === providerId,
  );
  const dragonfly =
    selectedProvider?.provider?.startsWith("dragonfly") ?? false;
  return (
    <ControlDialog
      title={policy ? "编辑预热策略" : "新建预热策略"}
      subtitle={project}
      submitLabel={policy ? "保存策略" : "创建策略"}
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          policy ? "preheat-policy" : "preheat-policies",
          policy ? { project, name: policy.name } : { project },
          policy ? "PUT" : "POST",
          policyPayload(projectId, policy, {
            providerId,
            name,
            description,
            repository,
            tag,
            label,
            triggerType,
            cron,
            scope: dragonfly ? scope : "",
            clusterIds: dragonfly ? clusterIds : "",
            enabled,
          }),
        );
        onSaved();
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("Provider 实例")}</span>
          <UnifiedSelect
            ariaLabel={t("Provider 实例")}
            name="provider_id"
            value={providerId}
            options={providers.map((provider) => ({
              value: String(provider.id),
              label: `${provider.provider ?? `#${String(provider.id)}`}${provider.default ? (locale === "en-US" ? " (default)" : "（默认）") : ""}`,
            }))}
            onChange={setProviderId}
          />
        </label>
        <label className="field">
          <span>{t("策略名称")}</span>
          <input
            required
            maxLength={255}
            pattern="[A-Za-z0-9]+([._-][A-Za-z0-9]+)*"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <input
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("仓库筛选")}</span>
          <input
            required
            value={repository}
            onChange={(event) => setRepository(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("Tag 筛选")}</span>
          <input
            required
            value={tag}
            onChange={(event) => setTag(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("标签筛选")}</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            placeholder={t("可选；多个标签用逗号分隔")}
          />
        </label>
        <label className="field">
          <span>{t("触发方式")}</span>
          <UnifiedSelect
            ariaLabel={t("触发方式")}
            name="trigger"
            value={triggerType}
            options={[
              { value: "manual", label: t("手动") },
              { value: "scheduled", label: t("定时") },
              { value: "event_based", label: t("制品推送事件") },
            ]}
            onChange={setTriggerType}
          />
        </label>
        {triggerType === "scheduled" ? (
          <label className="field">
            <span>{t("Cron 表达式")}</span>
            <input
              required
              value={cron}
              onChange={(event) => setCron(event.currentTarget.value)}
            />
            <small className="field-help">
              {t("Harbor 使用含秒字段的 Cron 表达式。")}
            </small>
          </label>
        ) : null}
        {dragonfly ? (
          <>
            <label className="field">
              <span>{t("Dragonfly 分发范围")}</span>
              <UnifiedSelect
                ariaLabel={t("Dragonfly 分发范围")}
                name="scope"
                value={scope}
                options={[
                  { value: "single_seed_peer", label: t("单个 Seed Peer") },
                  { value: "all_seed_peers", label: t("全部 Seed Peer") },
                  { value: "all_peers", label: t("全部 Peer") },
                ]}
                onChange={setScope}
              />
            </label>
            <label className="field">
              <span>{t("Dragonfly 集群 ID")}</span>
              <input
                value={clusterIds}
                onChange={(event) => setClusterIds(event.currentTarget.value)}
                placeholder="1,2,3"
              />
            </label>
          </>
        ) : null}
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
        />
        <span>
          <strong>{t("启用预热策略")}</strong>
          <small>{t("停用后保留配置但不再触发新任务")}</small>
        </span>
      </label>
    </ControlDialog>
  );
}

export function DeletePreheatPolicyDialog({
  project,
  policy,
  onClose,
  onDeleted,
}: {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除预热策略"
      subtitle={
        locale === "en-US"
          ? `Policy ${policy.name} and its execution history entry will be deleted.`
          : `策略 ${policy.name} 及其执行记录入口将被删除。`
      }
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "preheat-policy",
          { project, name: policy.name },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="danger-banner">{t("删除后无法恢复。")}</div>
    </ControlDialog>
  );
}

export function RunPreheatPolicyDialog({
  project,
  policy,
  onClose,
  onStarted,
}: {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="立即执行 P2P 预热"
      subtitle={policy.name}
      submitLabel="开始预热"
      submitIcon="play"
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "preheat-policy",
          { project, name: policy.name },
          "POST",
          runnablePolicyPayload(policy),
        );
        onStarted();
      }}
    >
      <div className="info-banner">
        <span>
          {t("Harbor 将按当前仓库、Tag 与标签筛选条件创建预热任务。")}
        </span>
      </div>
    </ControlDialog>
  );
}

export function PreheatExecutionsDialog({
  project,
  policy,
  onClose,
  onChanged,
  onNotice,
}: {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const requestVersion = useRef(0);
  const logController = useRef<AbortController | undefined>(undefined);
  const logViewRef = useRef<HTMLElement>(null);
  const [executionPage, setExecutionPage] = useState(1);
  const [executions, setExecutions] = useState<PreheatExecution[]>([]);
  const [executionPagination, setExecutionPagination] =
    useState(emptyPagination);
  const [selectedExecution, setSelectedExecution] =
    useState<PreheatExecution>();
  const [stopExecution, setStopExecution] = useState<PreheatExecution>();
  const [taskPage, setTaskPage] = useState(1);
  const [tasks, setTasks] = useState<PreheatTask[]>([]);
  const [taskPagination, setTaskPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<PreheatTask>();
  const [taskLog, setTaskLog] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [timezone, setTimezone] = useState<LogTimezone>("local");

  useEffect(
    () => () => {
      requestVersion.current += 1;
      logController.current?.abort();
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
      .list<PreheatExecution>(
        "preheat-executions",
        {
          project,
          name: policy.name,
          page: executionPage,
          page_size: 100,
          sort: "-start_time",
        },
        controller.signal,
      )
      .then((result) => {
        setExecutions(result.items);
        setExecutionPagination(result.pagination);
      })
      .catch((loadError: unknown) => {
        if (!(
          loadError instanceof DOMException && loadError.name === "AbortError"
        ))
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [executionPage, policy.name, project, selectedExecution]);

  const selectedExecutionId = selectedExecution?.id;
  useEffect(() => {
    if (selectedExecutionId === undefined) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelectedTask(undefined);
    setTaskLog("");
    void Promise.all([
      controlApi.data<PreheatExecution>(
        "preheat-execution",
        { project, name: policy.name, id: selectedExecutionId },
        controller.signal,
      ),
      controlApi.list<PreheatTask>(
        "preheat-tasks",
        {
          project,
          name: policy.name,
          id: selectedExecutionId,
          page: taskPage,
          page_size: 100,
          sort: "-creation_time",
        },
        controller.signal,
      ),
    ])
      .then(([execution, collection]) => {
        if (execution) setSelectedExecution(execution);
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
  }, [policy.name, project, selectedExecutionId, taskPage]);

  async function loadTaskLog(task: PreheatTask) {
    if (!selectedExecution) return;
    logController.current?.abort();
    const controller = new AbortController();
    logController.current = controller;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setSelectedTask(task);
    setLogLoading(true);
    try {
      const value = await controlApi.data<string>(
        "preheat-task-log",
        {
          project,
          name: policy.name,
          id: selectedExecution.id,
          task: task.id,
        },
        controller.signal,
      );
      if (requestVersion.current === version) setTaskLog(value ?? "");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError")
        return;
      if (requestVersion.current === version) {
        setTaskLog(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    } finally {
      if (requestVersion.current === version) setLogLoading(false);
    }
  }

  if (stopExecution) {
    return (
      <StopPreheatExecutionDialog
        project={project}
        policy={policy}
        execution={stopExecution}
        onClose={() => setStopExecution(undefined)}
        onStopped={() => onChanged("P2P 预热执行已停止")}
      />
    );
  }

  const detailSubtitle = selectedExecution
    ? locale === "en-US"
      ? `${t(executionStatusLabel(selectedExecution.status))} · ${formatNumber(taskPagination.total, locale)} tasks`
      : `${t(executionStatusLabel(selectedExecution.status))} · ${formatNumber(taskPagination.total, locale)} 个任务`
    : locale === "en-US"
      ? `${formatNumber(executionPagination.total, locale)} executions`
      : `${formatNumber(executionPagination.total, locale)} 次执行`;

  return (
    <ControlDialog
      title={
        selectedExecution
          ? locale === "en-US"
            ? `Preheat execution #${String(selectedExecution.id)}`
            : `预热执行 #${String(selectedExecution.id)}`
          : locale === "en-US"
            ? `Preheat policy ${policy.name}`
            : `预热策略 ${policy.name}`
      }
      subtitle={loading ? t("正在读取执行记录") : detailSubtitle}
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
          <span>
            {t(
              selectedExecution ? "正在载入预热任务..." : "正在载入预热执行...",
            )}
          </span>
        </div>
      ) : error ? (
        <div className="empty-table permission-table">
          <strong>
            {t(selectedExecution ? "预热任务载入失败" : "预热执行记录载入失败")}
          </strong>
          <span>{error}</span>
        </div>
      ) : selectedExecution ? (
        <>
          <section className="execution-summary">
            <div className="execution-summary-head">
              <div>
                <StatusBadge status={selectedExecution.status} />
                <span>{t(triggerLabel(selectedExecution.trigger))}</span>
                <span>{formatDate(selectedExecution.start_time, locale)}</span>
              </div>
              {canStopExecution(selectedExecution.status) ? (
                <button
                  className="button button-small button-danger"
                  type="button"
                  onClick={() => setStopExecution(selectedExecution)}
                >
                  <Icon name="x" />
                  <span>{t("停止执行")}</span>
                </button>
              ) : null}
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
                <h3>{t("预热任务")}</h3>
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
                  <strong>{t("暂无预热任务")}</strong>
                  <span>{t("该执行记录还没有返回任务明细。")}</span>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th className="id-column">{t("任务")}</th>
                      <th>{t("制品")}</th>
                      <th>{t("摘要")}</th>
                      <th>{t("类型")}</th>
                      <th>{t("状态")}</th>
                      <th>{locale === "en-US" ? "Retries" : "重试"}</th>
                      <th className="table-cell-time">{t("开始时间")}</th>
                      <th className="table-cell-time">{t("结束时间")}</th>
                      <th>{locale === "en-US" ? "Log" : "日志"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="id-cell">#{task.id}</td>
                        <td
                          className="replication-resource"
                          title={task.extra_attrs?.artifact}
                        >
                          {task.extra_attrs?.artifact ?? "-"}
                        </td>
                        <td>
                          <code title={task.extra_attrs?.digest}>
                            {t(shortDigest(task.extra_attrs?.digest))}
                          </code>
                        </td>
                        <td>
                          {locale === "en-US"
                            ? resourceTypeText(task.extra_attrs?.kind, locale)
                            : t(
                                resourceTypeText(
                                  task.extra_attrs?.kind,
                                  locale,
                                ),
                              )}
                        </td>
                        <td>
                          <StatusBadge status={task.status} />
                        </td>
                        <td>{formatNumber(task.run_count, locale)}</td>
                        <td className="table-cell-time">
                          {formatDate(task.start_time, locale)}
                        </td>
                        <td className="table-cell-time">
                          {formatDate(task.end_time, locale)}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            type="button"
                            title={t("查看日志")}
                            aria-label={t("查看预热任务日志")}
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
            {taskPagination.total > taskPagination.page_size ? (
              <DialogPagination
                pagination={taskPagination}
                onPageChange={setTaskPage}
              />
            ) : null}
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
                    aria-label={t("刷新预热任务日志")}
                    onClick={() => void loadTaskLog(selectedTask)}
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("复制日志")}
                    aria-label={t("复制预热任务日志")}
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
                    aria-label={t("下载预热任务日志")}
                    onClick={() => {
                      if (!taskLog) {
                        onNotice("当前没有可下载的预热任务日志", true);
                        return;
                      }
                      downloadText(
                        taskLog,
                        `harbor-preheat-${String(selectedExecution.id)}-${String(selectedTask.id)}.log`,
                      );
                      onNotice("预热任务日志已下载");
                    }}
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("关闭日志")}
                    aria-label={t("关闭预热任务日志")}
                    onClick={() => {
                      requestVersion.current += 1;
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
                emptyMessage="Harbor 没有返回预热任务日志。"
                ariaLabel="预热任务日志"
              />
            </section>
          ) : null}
        </>
      ) : (
        <section className="replication-task-section">
          <div className="section-heading compact-heading">
            <div>
              <h3>{t("预热执行记录")}</h3>
              <p>
                {locale === "en-US"
                  ? `${formatNumber(executionPagination.total, locale)} executions`
                  : `共 ${formatNumber(executionPagination.total, locale)} 次执行`}
              </p>
            </div>
          </div>
          <div className="table-scroll">
            {!executions.length ? (
              <div className="empty-table">
                <strong>{t("暂无预热执行")}</strong>
                <span>{t("手动执行或触发策略后会显示在这里。")}</span>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="id-column">{t("执行")}</th>
                    <th>{t("触发方式")}</th>
                    <th>{t("状态")}</th>
                    <th>{t("任务")}</th>
                    <th>{t("成功")}</th>
                    <th>{t("失败")}</th>
                    <th className="table-cell-time">{t("开始时间")}</th>
                    <th className="table-cell-time">{t("耗时")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution.id}>
                      <td className="id-cell">#{execution.id}</td>
                      <td>{t(triggerLabel(execution.trigger))}</td>
                      <td>
                        <StatusBadge status={execution.status} />
                      </td>
                      <td>
                        {formatNumber(execution.metrics?.task_count, locale)}
                      </td>
                      <td className="success-text">
                        {formatNumber(
                          execution.metrics?.success_task_count,
                          locale,
                        )}
                      </td>
                      <td className="danger-text">
                        {formatNumber(
                          execution.metrics?.error_task_count,
                          locale,
                        )}
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
                          className="button button-small"
                          type="button"
                          aria-label={t("查看预热执行任务")}
                          onClick={() => {
                            setTaskPage(1);
                            setSelectedExecution(execution);
                          }}
                        >
                          <Icon name="history" />
                          <span>
                            {locale === "en-US" ? "View tasks" : t("查看任务")}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {executionPagination.total > executionPagination.page_size ? (
            <DialogPagination
              pagination={executionPagination}
              onPageChange={setExecutionPage}
            />
          ) : null}
        </section>
      )}
    </ControlDialog>
  );
}

export function StopPreheatExecutionDialog({
  project,
  policy,
  execution,
  onClose,
  onStopped,
}: {
  project: string;
  policy: PreheatPolicy;
  execution: PreheatExecution;
  onClose: () => void;
  onStopped: () => void;
}) {
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
        await controlApi.mutate(
          "preheat-execution",
          { project, name: policy.name, id: execution.id },
          "PATCH",
          { status: "Stopped" },
        );
        onStopped();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {t("已经完成的预热任务不会回滚，运行中的任务将由 Harbor 请求停止。")}
        </span>
      </div>
    </ControlDialog>
  );
}
