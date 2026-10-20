import { type SubmitEvent, useState } from "react";

import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ReplicationExecution, ReplicationPolicy } from "../../app/models";
import { SortableHeader } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";
import type { ExecutionFilterValues } from "./replication-routing";
import { policyDirection, policyRemote } from "./replication-sorting";

export function ReplicationPolicyFilter({
  query,
  onSearch,
}: {
  query: string;
  onSearch: (query: string) => void;
}) {
  const { t } = useLocale();
  return (
    <form
      className="table-toolbar"
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q");
        onSearch(typeof value === "string" ? value.trim() : "");
      }}
    >
      <div className="toolbar-search">
        <Icon name="search" />
        <input
          name="q"
          type="search"
          maxLength={255}
          defaultValue={query}
          placeholder={t("按策略名称搜索")}
          aria-label={t("按策略名称搜索")}
        />
      </div>
      <button className="button button-small button-primary" type="submit">
        <Icon name="search" />
        <span>{t("筛选")}</span>
      </button>
      {query ? (
        <button
          className="button button-small"
          type="button"
          onClick={() => onSearch("")}
        >
          {t("取消筛选")}
        </button>
      ) : null}
    </form>
  );
}

export function ReplicationExecutionFilter({
  policies,
  values,
  onApply,
}: {
  policies: ReplicationPolicy[];
  values: ExecutionFilterValues;
  onApply: (values: ExecutionFilterValues) => void;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(values);
  const hasActiveFilters = Boolean(
    values.policy_id || values.status || values.trigger,
  );
  const update = (field: keyof ExecutionFilterValues) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <form
      className="table-toolbar filter-toolbar"
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="filter-toolbar-query">
        <div className="filter-toolbar-controls">
          <label className="toolbar-field">
            <span>{t("策略")}</span>
            <UnifiedSelect
              name="policy_id"
              ariaLabel={t("策略")}
              className="toolbar-select replication-execution-policy-select"
              value={draft.policy_id}
              options={[
                { value: "", label: t("全部策略") },
                ...policies.map((policy) => ({
                  value: String(policy.id),
                  label: policy.name ?? `#${String(policy.id ?? "-")}`,
                })),
              ]}
              onChange={update("policy_id")}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("状态")}</span>
            <UnifiedSelect
              name="status"
              ariaLabel={t("状态")}
              className="toolbar-select"
              value={draft.status}
              options={[
                { value: "", label: t("全部状态") },
                { value: "InProgress", label: t("进行中") },
                { value: "Succeed", label: t("成功") },
                { value: "Failed", label: t("失败") },
                { value: "Stopped", label: t("已停止") },
              ]}
              onChange={update("status")}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("触发方式")}</span>
            <UnifiedSelect
              name="trigger"
              ariaLabel={t("触发方式")}
              className="toolbar-select"
              value={draft.trigger}
              options={[
                { value: "", label: t("全部方式") },
                ...["manual", "scheduled", "event_based"].map((value) => ({
                  value,
                  label: triggerLabel(value, t),
                })),
              ]}
              onChange={update("trigger")}
            />
          </label>
          <div className="filter-toolbar-actions">
            <button
              className="button button-small button-primary"
              type="submit"
            >
              <Icon name="search" />
              <span>{t("筛选")}</span>
            </button>
            {hasActiveFilters ? (
              <button
                className="button button-small"
                type="button"
                onClick={() =>
                  onApply({ policy_id: "", status: "", trigger: "" })
                }
              >
                {t("取消筛选")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}

export function ReplicationPolicyTable({
  policies,
  sort,
  onSort,
  onRun,
  onEdit,
  onDelete,
}: {
  policies: ReplicationPolicy[];
  sort: string;
  onSort: (sort: string) => void;
  onRun: (policy: ReplicationPolicy) => void;
  onEdit: (policy: ReplicationPolicy) => void;
  onDelete: (policy: ReplicationPolicy) => void;
}) {
  const { locale, t } = useLocale();
  if (!policies.length) {
    return (
      <EmptyState
        title="暂无复制策略"
        description="创建策略后可以在实例间同步制品。"
        icon="refresh"
      />
    );
  }
  const header = (label: string, field: string, className?: string) => (
    <SortableHeader
      label={label}
      field={field}
      className={className}
      currentSort={sort}
      onSort={onSort}
    />
  );
  return (
    <table className="replication-policy-table">
      <thead>
        <tr>
          {header("策略", "name")}
          {header("方向", "direction", "table-cell-center")}
          {header("远端仓库", "remote")}
          {header("触发方式", "trigger", "table-cell-center")}
          {header("状态", "enabled", "table-cell-center")}
          <th />
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => {
          const direction = policyDirection(policy);
          const remote = policyRemote(policy);
          return (
            <tr key={policy.id}>
              <td>
                <div className="cell-title">
                  <span className="cell-icon">
                    <Icon name="refresh" />
                  </span>
                  <span className="cell-stack">
                    <strong>{policy.name ?? "-"}</strong>
                    <small>
                      {policy.description
                        ? t(policy.description)
                        : `${t("策略")} #${String(policy.id ?? "-")}`}
                    </small>
                  </span>
                </div>
              </td>
              <td className="table-cell-center">
                <span className="badge badge-blue">
                  {locale === "en-US"
                    ? direction
                    : t(direction === "push" ? "推送" : "拉取")}
                </span>
              </td>
              <td>
                <span className="replication-policy-remote" title={remote}>
                  {remote}
                </span>
              </td>
              <td className="table-cell-center">
                {triggerLabel(policy.trigger?.type, t)}
              </td>
              <td className="table-cell-center">
                {policy.enabled ? (
                  <span className="badge badge-green">{t("已启用")}</span>
                ) : (
                  <span className="badge">{t("已停用")}</span>
                )}
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    type="button"
                    title={t("立即执行")}
                    aria-label={t("立即执行")}
                    onClick={() => onRun(policy)}
                  >
                    <Icon name="play" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("编辑策略")}
                    aria-label={t("编辑策略")}
                    onClick={() => onEdit(policy)}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    title={t("删除策略")}
                    aria-label={t("删除策略")}
                    onClick={() => onDelete(policy)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ReplicationExecutionTable({
  executions,
  policies,
  sort,
  onSort,
  onOpen,
}: {
  executions: ReplicationExecution[];
  policies: ReplicationPolicy[];
  sort: string;
  onSort: (sort: string) => void;
  onOpen: (execution: ReplicationExecution, policy?: ReplicationPolicy) => void;
}) {
  const { locale, t } = useLocale();
  if (!executions.length) {
    return (
      <EmptyState
        title="暂无复制记录"
        description="运行复制策略后，执行结果会显示在这里。"
        icon="refresh"
      />
    );
  }
  const header = (
    label: string,
    field: string,
    className?: string,
    descendingFirst = false,
  ) => (
    <SortableHeader
      label={label}
      field={field}
      className={className}
      descendingFirst={descendingFirst}
      currentSort={sort}
      onSort={onSort}
    />
  );
  return (
    <table className="replication-execution-table">
      <thead>
        <tr>
          {header("执行编号", "id")}
          {header("策略", "policy")}
          {header("触发方式", "trigger", "table-cell-center")}
          {header("状态", "status", "table-cell-center")}
          {header("任务统计", "tasks", "table-cell-number", true)}
          {header("开始时间", "start_time", "table-cell-time", true)}
          {header("耗时", "duration", "table-cell-time", true)}
          <th className="table-cell-center">{t("日志")}</th>
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => {
          const policy = policies.find(
            (item) => item.id === execution.policy_id,
          );
          const policyName =
            policy?.name ??
            `${t("策略")} #${String(execution.policy_id ?? "-")}`;
          return (
            <tr key={execution.id}>
              <td className="id-cell">#{execution.id ?? "-"}</td>
              <td>
                <div className="replication-execution-policy-cell">
                  <strong
                    className="replication-execution-policy"
                    title={policyName}
                  >
                    {policyName}
                  </strong>
                </div>
              </td>
              <td className="table-cell-center">
                {triggerLabel(execution.trigger, t)}
              </td>
              <td className="table-cell-center">
                <StatusBadge status={execution.status} />
              </td>
              <td className="table-cell-number">
                <span className="execution-counts">
                  <b className="success-text">
                    {formatNumber(execution.succeed, locale)}
                  </b>
                  <b className="danger-text">
                    {formatNumber(execution.failed, locale)}
                  </b>
                  <span>{formatNumber(execution.in_progress, locale)}</span>
                </span>
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
              <td className="table-cell-center">
                <button
                  className="icon-button"
                  type="button"
                  title={t("查看任务")}
                  aria-label={t("查看任务")}
                  onClick={() => onOpen(execution, policy)}
                >
                  <Icon name="history" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
