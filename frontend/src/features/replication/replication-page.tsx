import { ContentTransition } from "../../components/content-transition";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { controlApi, loadAllControlItems } from "../../app/api-client";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationExecution,
  ReplicationPolicy,
} from "../../app/models";
import {
  createSortValues,
  Pagination,
  SortableHeader,
} from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

type ReplicationTab = "executions" | "policies";

const policySorts = createSortValues([
  "id",
  "name",
  "direction",
  "remote",
  "trigger",
  "enabled",
  "update_time",
]);
const executionSorts = createSortValues([
  "id",
  "policy",
  "trigger",
  "status",
  "tasks",
  "start_time",
  "duration",
]);

export type ReplicationAction =
  | {
      kind: "create";
      registries: Registry[];
      labels: ProjectLabel[];
      localInfo?: ReplicationAdapterInfo;
    }
  | {
      kind: "edit";
      policy: ReplicationPolicy;
      registries: Registry[];
      labels: ProjectLabel[];
      localInfo?: ReplicationAdapterInfo;
    }
  | { kind: "run"; policy: ReplicationPolicy }
  | { kind: "delete"; policy: ReplicationPolicy }
  | {
      kind: "execution";
      execution: ReplicationExecution;
      policy?: ReplicationPolicy;
    };

function replicationPath(
  tab: ReplicationTab,
  page = 1,
  pageSize = 50,
  values: Record<string, string | number | undefined> = {},
): string {
  const query = new URLSearchParams();
  if (tab !== "policies") query.set("tab", tab);
  if (page > 1) query.set("page", String(page));
  if (pageSize !== 50) query.set("page_size", String(pageSize));
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return `replication${query.size ? `?${query}` : ""}`;
}

function policyRemote(policy: ReplicationPolicy): string {
  const remote =
    (policy.dest_registry?.id ?? 0) > 0
      ? policy.dest_registry
      : policy.src_registry;
  return remote?.name ?? `#${String(remote?.id ?? "-")}`;
}

function policyDirection(policy: ReplicationPolicy): "pull" | "push" {
  return (policy.dest_registry?.id ?? 0) > 0 ? "push" : "pull";
}

function compareValues(
  left: number | string,
  right: number | string,
  locale: string,
): number {
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  return left.toString().localeCompare(right.toString(), locale);
}

function dateValue(value: string | undefined): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function executionDuration(execution: ReplicationExecution): number {
  const start = dateValue(execution.start_time);
  const end = dateValue(execution.end_time);
  return start && end ? Math.max(0, end - start) : 0;
}

function executionTaskCount(execution: ReplicationExecution): number {
  return (
    execution.total ??
    (execution.succeed ?? 0) +
      (execution.failed ?? 0) +
      (execution.in_progress ?? 0) +
      (execution.stopped ?? 0)
  );
}

function ReplicationExecutionFilter({
  policies,
  values,
  pageSize,
  sort,
  navigate,
}: {
  policies: ReplicationPolicy[];
  values: { policy_id: string; status: string; trigger: string };
  pageSize: number;
  sort: string;
  navigate: (path: string) => void;
}) {
  const { t } = useLocale();
  const [policyId, setPolicyId] = useState(values.policy_id);
  const [status, setStatus] = useState(values.status);
  const [trigger, setTrigger] = useState(values.trigger);
  const hasActiveFilters = Boolean(
    values.policy_id || values.status || values.trigger,
  );

  return (
    <form
      className="table-toolbar filter-toolbar"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        navigate(
          replicationPath("executions", 1, pageSize, {
            policy_id: policyId,
            status,
            trigger,
            sort: sort === "-start_time" ? "" : sort,
          }),
        );
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
              value={policyId}
              options={[
                { value: "", label: t("全部策略") },
                ...policies.map((policy) => ({
                  value: String(policy.id),
                  label: policy.name ?? `#${String(policy.id ?? "-")}`,
                })),
              ]}
              onChange={setPolicyId}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("状态")}</span>
            <UnifiedSelect
              name="status"
              ariaLabel={t("状态")}
              className="toolbar-select"
              value={status}
              options={[
                { value: "", label: t("全部状态") },
                { value: "InProgress", label: t("进行中") },
                { value: "Succeed", label: t("成功") },
                { value: "Failed", label: t("失败") },
                { value: "Stopped", label: t("已停止") },
              ]}
              onChange={setStatus}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("触发方式")}</span>
            <UnifiedSelect
              name="trigger"
              ariaLabel={t("触发方式")}
              className="toolbar-select"
              value={trigger}
              options={[
                { value: "", label: t("全部方式") },
                ...["manual", "scheduled", "event_based"].map((value) => ({
                  value,
                  label: triggerLabel(value, t),
                })),
              ]}
              onChange={setTrigger}
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
                  navigate(
                    replicationPath("executions", 1, pageSize, {
                      sort: sort === "-start_time" ? "" : sort,
                    }),
                  )
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

export function ReplicationPage({
  route,
  demo,
  refreshing,
  navigate,
  onRefresh,
  onAction,
}: {
  route: ConsoleRoute;
  demo: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onAction: (action: ReplicationAction) => void;
}) {
  const { locale, t } = useLocale();
  const tab: ReplicationTab =
    route.query.get("tab") === "executions" ? "executions" : "policies";
  const pageValue = Number(route.query.get("page"));
  const pageSizeValue = Number(route.query.get("page_size"));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = [20, 50, 100].includes(pageSizeValue) ? pageSizeValue : 50;
  const defaultSort = tab === "policies" ? "id" : "-start_time";
  const requestedSort = route.query.get("sort") ?? defaultSort;
  const sort = (tab === "policies" ? policySorts : executionSorts).has(
    requestedSort,
  )
    ? requestedSort
    : defaultSort;
  const [policies, setPolicies] = useState<ReplicationPolicy[]>();
  const [executions, setExecutions] = useState<ReplicationExecution[]>();
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [localInfo, setLocalInfo] = useState<ReplicationAdapterInfo>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const policyFilter = route.query.get("q") ?? "";
  const executionPolicyId = route.query.get("policy_id") ?? "";
  const executionStatus = route.query.get("status") ?? "";
  const executionTrigger = route.query.get("trigger") ?? "";

  useEffect(() => {
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setLoading(true);
    setError("");
    const executionParameters: Record<string, string | number> = {};
    if (executionStatus) executionParameters.status = executionStatus;
    if (executionTrigger) executionParameters.trigger = executionTrigger;
    if (executionPolicyId) executionParameters.policy_id = executionPolicyId;
    void Promise.all([
      loadAllControlItems<ReplicationPolicy>(
        "replication-policies",
        policyFilter ? { name: policyFilter } : {},
        controller.signal,
      ),
      tab === "executions"
        ? loadAllControlItems<ReplicationExecution>(
            "replication-executions",
            executionParameters,
            controller.signal,
          )
        : Promise.resolve([]),
      controlApi.list<Registry>(
        "registries",
        { page: 1, page_size: 100, sort: "name" },
        controller.signal,
      ),
      controlApi
        .list<ProjectLabel>(
          "labels",
          { page: 1, page_size: 100, sort: "name", scope: "g" },
          controller.signal,
        )
        .catch(() => ({
          items: [],
          pagination: { page: 1, page_size: 100, total: 0 },
        })),
      controlApi
        .data<ReplicationAdapterInfo>(
          "registry-info",
          { id: 0 },
          controller.signal,
        )
        .catch(() => undefined),
    ])
      .then(
        ([policyItems, executionItems, registryItems, labelItems, info]) => {
          if (requestVersion.current !== current) return;
          setPolicies(policyItems);
          setExecutions(executionItems);
          setRegistries(registryItems.items);
          setLabels(labelItems.items);
          setLocalInfo(info);
        },
      )
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        if (requestVersion.current === current)
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && requestVersion.current === current) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [
    executionPolicyId,
    executionStatus,
    executionTrigger,
    policyFilter,
    tab,
    version,
  ]);

  const sortedPolicies = useMemo(
    () =>
      [...(policies ?? [])].sort((left, right) => {
        const descending = sort.startsWith("-");
        const field = sort.replace(/^-/, "");
        const values = (() => {
          if (field === "id") return [left.id ?? 0, right.id ?? 0];
          if (field === "name") return [left.name ?? "", right.name ?? ""];
          if (field === "direction")
            return [policyDirection(left), policyDirection(right)];
          if (field === "remote")
            return [policyRemote(left), policyRemote(right)];
          if (field === "trigger")
            return [left.trigger?.type ?? "", right.trigger?.type ?? ""];
          if (field === "enabled")
            return [Number(left.enabled), Number(right.enabled)];
          return [dateValue(left.update_time), dateValue(right.update_time)];
        })();
        const comparison = compareValues(values[0], values[1], locale);
        return descending ? -comparison : comparison;
      }),
    [locale, policies, sort],
  );

  const sortedExecutions = useMemo(
    () =>
      [...(executions ?? [])].sort((left, right) => {
        const descending = sort.startsWith("-");
        const field = sort.replace(/^-/, "");
        const policyName = (execution: ReplicationExecution) =>
          policies?.find((policy) => policy.id === execution.policy_id)?.name ??
          "";
        const values = (() => {
          if (field === "id") return [left.id ?? 0, right.id ?? 0];
          if (field === "policy") return [policyName(left), policyName(right)];
          if (field === "trigger")
            return [left.trigger ?? "", right.trigger ?? ""];
          if (field === "status")
            return [left.status ?? "", right.status ?? ""];
          if (field === "tasks")
            return [executionTaskCount(left), executionTaskCount(right)];
          if (field === "duration")
            return [executionDuration(left), executionDuration(right)];
          return [dateValue(left.start_time), dateValue(right.start_time)];
        })();
        const comparison = compareValues(values[0], values[1], locale);
        return descending ? -comparison : comparison;
      }),
    [executions, locale, policies, sort],
  );

  const allItems = tab === "policies" ? sortedPolicies : sortedExecutions;
  const pagedItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  const pagination = { page, page_size: pageSize, total: allItems.length };
  const executionFilters = {
    policy_id: executionPolicyId,
    status: executionStatus,
    trigger: executionTrigger,
  };

  return (
    <>
      <PageHeader
        title="复制管理"
        subtitle={t("检查复制策略和最近执行记录")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || !policies}
              onRefresh={() => {
                reload();
                onRefresh();
              }}
            />
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() =>
                onAction({ kind: "create", registries, labels, localInfo })
              }
            >
              <Icon name="plus" />
              <span>{t("新建策略")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      <nav
        className="resource-tabs replication-list-tabs"
        aria-label={t("复制管理页面")}
      >
        <a
          href="#/replication"
          className={tab === "policies" ? "active" : ""}
          aria-current={tab === "policies" ? "page" : undefined}
        >
          <Icon name="settings" />
          <span>{t("复制策略")}</span>
        </a>
        <a
          href="#/replication?tab=executions"
          className={tab === "executions" ? "active" : ""}
          aria-current={tab === "executions" ? "page" : undefined}
        >
          <Icon name="history" />
          <span>{t("执行记录")}</span>
        </a>
      </nav>
      <ContentTransition mode={tab}>
        {error ? (
          <section className="security-module-state" role="alert">
            <span className="state-icon">
              <Icon name="alert" />
            </span>
            <div>
              <h2>{t("复制数据载入失败")}</h2>
              <p>{error}</p>
            </div>
            <button
              className="button button-small"
              type="button"
              onClick={reload}
            >
              <Icon name="refresh" />
              <span>{t("重新尝试")}</span>
            </button>
          </section>
        ) : null}
        {loading &&
        ((tab === "policies" && !policies) ||
          (tab === "executions" && !executions)) &&
        !error ? (
          <section className="table-shell">
            <div className="loading-state">
              <div>
                <span className="spinner" />
              </div>
            </div>
          </section>
        ) : null}
        {policies && tab === "policies" ? (
          <section className="replication-policies-section">
            <div className="section-heading replication-policy-heading">
              <div>
                <h2>
                  {t("复制策略")}{" "}
                  <span className="section-count">
                    {locale === "en-US"
                      ? `${formatNumber(sortedPolicies.length, locale)} entries`
                      : `${formatNumber(sortedPolicies.length, locale)} 条`}
                  </span>
                </h2>
              </div>
            </div>
            <div className="table-shell">
              <form
                className="table-toolbar"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const raw = new FormData(event.currentTarget).get("q");
                  navigate(
                    replicationPath("policies", 1, pageSize, {
                      q: typeof raw === "string" ? raw.trim() : "",
                      sort: sort === "id" ? "" : sort,
                    }),
                  );
                }}
              >
                <div className="toolbar-search">
                  <Icon name="search" />
                  <input
                    name="q"
                    type="search"
                    maxLength={255}
                    defaultValue={policyFilter}
                    placeholder={t("按策略名称搜索")}
                    aria-label={t("按策略名称搜索")}
                  />
                </div>
                <button
                  className="button button-small button-primary"
                  type="submit"
                >
                  <Icon name="search" />
                  <span>{t("筛选")}</span>
                </button>
                {policyFilter ? (
                  <button
                    className="button button-small"
                    type="button"
                    onClick={() =>
                      navigate(replicationPath("policies", 1, pageSize))
                    }
                  >
                    {t("取消筛选")}
                  </button>
                ) : null}
              </form>
              <div className="table-scroll">
                {pagedItems.length ? (
                  <table className="replication-policy-table">
                    <thead>
                      <tr>
                        <SortableHeader
                          label="策略"
                          field="name"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("policies", 1, pageSize, {
                                q: policyFilter,
                                sort: nextSort === "id" ? "" : nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="方向"
                          field="direction"
                          className="table-cell-center"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("policies", 1, pageSize, {
                                q: policyFilter,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="远端仓库"
                          field="remote"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("policies", 1, pageSize, {
                                q: policyFilter,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="触发方式"
                          field="trigger"
                          className="table-cell-center"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("policies", 1, pageSize, {
                                q: policyFilter,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="状态"
                          field="enabled"
                          className="table-cell-center"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("policies", 1, pageSize, {
                                q: policyFilter,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(pagedItems as ReplicationPolicy[]).map((policy) => (
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
                                ? policyDirection(policy)
                                : t(
                                    policyDirection(policy) === "push"
                                      ? "推送"
                                      : "拉取",
                                  )}
                            </span>
                          </td>
                          <td>
                            <span
                              className="replication-policy-remote"
                              title={policyRemote(policy)}
                            >
                              {policyRemote(policy)}
                            </span>
                          </td>
                          <td className="table-cell-center">
                            {triggerLabel(policy.trigger?.type, t)}
                          </td>
                          <td className="table-cell-center">
                            {policy.enabled ? (
                              <span className="badge badge-green">
                                {t("已启用")}
                              </span>
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
                                onClick={() =>
                                  onAction({ kind: "run", policy })
                                }
                              >
                                <Icon name="play" />
                              </button>
                              <button
                                className="icon-button"
                                type="button"
                                title={t("编辑策略")}
                                aria-label={t("编辑策略")}
                                onClick={() =>
                                  onAction({
                                    kind: "edit",
                                    policy,
                                    registries,
                                    labels,
                                    localInfo,
                                  })
                                }
                              >
                                <Icon name="edit" />
                              </button>
                              <button
                                className="icon-button danger-icon"
                                type="button"
                                title={t("删除策略")}
                                aria-label={t("删除策略")}
                                onClick={() =>
                                  onAction({ kind: "delete", policy })
                                }
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState
                    title="暂无复制策略"
                    description="创建策略后可以在实例间同步制品。"
                    icon="refresh"
                  />
                )}
              </div>
              <Pagination
                pagination={pagination}
                onPageChange={(next) =>
                  navigate(
                    replicationPath("policies", next, pageSize, {
                      q: policyFilter,
                      sort: sort === "id" ? "" : sort,
                    }),
                  )
                }
                pageSizeOptions={[20, 50, 100]}
                onPageSizeChange={(nextPageSize) =>
                  navigate(
                    replicationPath("policies", 1, nextPageSize, {
                      q: policyFilter,
                      sort: sort === "id" ? "" : sort,
                    }),
                  )
                }
              />
            </div>
          </section>
        ) : null}
        {policies && executions && tab === "executions" ? (
          <section className="replication-executions-section">
            <div className="section-heading replication-policy-heading">
              <div>
                <h2>
                  {t("执行记录")}{" "}
                  <span className="section-count">
                    {locale === "en-US"
                      ? `${formatNumber(sortedExecutions.length, locale)} entries`
                      : `${formatNumber(sortedExecutions.length, locale)} 条`}
                  </span>
                </h2>
              </div>
            </div>
            <div className="table-shell">
              <ReplicationExecutionFilter
                key={`${executionFilters.policy_id}-${executionFilters.status}-${executionFilters.trigger}`}
                policies={policies}
                values={executionFilters}
                pageSize={pageSize}
                sort={sort}
                navigate={navigate}
              />
              <div className="table-scroll">
                {pagedItems.length ? (
                  <table className="replication-execution-table">
                    <thead>
                      <tr>
                        <SortableHeader
                          label="执行编号"
                          field="id"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="策略"
                          field="policy"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="触发方式"
                          field="trigger"
                          className="table-cell-center"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="状态"
                          field="status"
                          className="table-cell-center"
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="任务统计"
                          field="tasks"
                          className="table-cell-number"
                          descendingFirst
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="开始时间"
                          field="start_time"
                          className="table-cell-time"
                          descendingFirst
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort:
                                  nextSort === "-start_time" ? "" : nextSort,
                              }),
                            )
                          }
                        />
                        <SortableHeader
                          label="耗时"
                          field="duration"
                          className="table-cell-time"
                          descendingFirst
                          currentSort={sort}
                          onSort={(nextSort) =>
                            navigate(
                              replicationPath("executions", 1, pageSize, {
                                ...executionFilters,
                                sort: nextSort,
                              }),
                            )
                          }
                        />
                        <th className="table-cell-center">{t("日志")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pagedItems as ReplicationExecution[]).map(
                        (execution) => {
                          const policy = policies.find(
                            (item) => item.id === execution.policy_id,
                          );
                          const policyName =
                            policy?.name ??
                            `${t("策略")} #${String(execution.policy_id ?? "-")}`;
                          return (
                            <tr key={execution.id}>
                              <td className="id-cell">
                                #{execution.id ?? "-"}
                              </td>
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
                                  <span>
                                    {formatNumber(
                                      execution.in_progress,
                                      locale,
                                    )}
                                  </span>
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
                                  onClick={() =>
                                    onAction({
                                      kind: "execution",
                                      execution,
                                      policy,
                                    })
                                  }
                                >
                                  <Icon name="history" />
                                </button>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState
                    title="暂无复制记录"
                    description="运行复制策略后，执行结果会显示在这里。"
                    icon="refresh"
                  />
                )}
              </div>
              <Pagination
                pagination={pagination}
                onPageChange={(next) =>
                  navigate(
                    replicationPath("executions", next, pageSize, {
                      ...executionFilters,
                      sort: sort === "-start_time" ? "" : sort,
                    }),
                  )
                }
                pageSizeOptions={[20, 50, 100]}
                onPageSizeChange={(nextPageSize) =>
                  navigate(
                    replicationPath("executions", 1, nextPageSize, {
                      ...executionFilters,
                      sort: sort === "-start_time" ? "" : sort,
                    }),
                  )
                }
              />
            </div>
          </section>
        ) : null}
      </ContentTransition>
    </>
  );
}
