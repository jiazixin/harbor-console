import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { controlApi } from "../../app/api-client";
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
import { Pagination } from "../../components/data-table";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

type ReplicationTab = "executions" | "policies";

const policySorts = new Set([
  "id",
  "-id",
  "name",
  "-update_time",
  "update_time",
]);
const executionSorts = new Set(["-start_time", "start_time"]);

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

async function loadAll<T>(
  operation: string,
  parameters: Record<string, string | number>,
  signal: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await controlApi.list<T>(
      operation,
      { ...parameters, page, page_size: 100 },
      signal,
    );
    items.push(...result.items);
    if (items.length >= result.pagination.total || result.items.length < 100)
      break;
  }
  return items;
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

function EmptyReplication({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useLocale();
  return (
    <div className="empty-table">
      <Icon name="refresh" />
      <div>
        <strong>{t(title)}</strong>
        <span>{t(description)}</span>
      </div>
    </div>
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
                ...["InProgress", "Succeed", "Failed", "Stopped"].map(
                  (value) => ({ value, label: t(value) }),
                ),
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
          </div>
        </div>
      </div>
      <div className="filter-toolbar-meta">
        <label className="toolbar-field">
          <span>{t("排序")}</span>
          <UnifiedSelect
            ariaLabel={t("排序")}
            className="toolbar-select"
            value={sort}
            options={[
              { value: "-start_time", label: t("最近开始") },
              { value: "start_time", label: t("最早开始") },
            ]}
            onChange={(nextSort) =>
              navigate(
                replicationPath("executions", 1, pageSize, {
                  ...values,
                  sort: nextSort === "-start_time" ? "" : nextSort,
                }),
              )
            }
          />
        </label>
        <label className="toolbar-field">
          <span>{t("每页")}</span>
          <UnifiedSelect
            ariaLabel={t("每页条数")}
            className="toolbar-select"
            value={String(pageSize)}
            options={[20, 50, 100].map((nextPageSize) => ({
              value: String(nextPageSize),
              label: `${String(nextPageSize)} ${t("条")}`,
            }))}
            onChange={(nextPageSize) =>
              navigate(
                replicationPath("executions", 1, Number(nextPageSize), {
                  ...values,
                  sort: sort === "-start_time" ? "" : sort,
                }),
              )
            }
          />
        </label>
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
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const loadKey = route.query.toString();

  useEffect(() => {
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setPolicies(undefined);
    setExecutions(undefined);
    setError("");
    const policyFilter = route.query.get("q") ?? "";
    const executionParameters: Record<string, string | number> = {};
    for (const key of ["status", "trigger", "policy_id"] as const) {
      const value = route.query.get(key);
      if (value) executionParameters[key] = value;
    }
    void Promise.all([
      loadAll<ReplicationPolicy>(
        "replication-policies",
        policyFilter ? { name: policyFilter } : {},
        controller.signal,
      ),
      tab === "executions"
        ? loadAll<ReplicationExecution>(
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
      });
    return () => controller.abort();
  }, [loadKey, route, tab, version]);

  const sortedPolicies = useMemo(
    () =>
      [...(policies ?? [])].sort((left, right) => {
        const descending = sort.startsWith("-");
        const field = sort.replace(/^-/, "");
        const values =
          field === "id"
            ? [left.id ?? 0, right.id ?? 0]
            : field === "name"
              ? [left.name ?? "", right.name ?? ""]
              : [
                  new Date(left.update_time ?? "").getTime(),
                  new Date(right.update_time ?? "").getTime(),
                ];
        const comparison = compareValues(values[0], values[1], locale);
        return descending ? -comparison : comparison;
      }),
    [locale, policies, sort],
  );

  const sortedExecutions = useMemo(
    () =>
      [...(executions ?? [])].sort((left, right) => {
        const descending = sort.startsWith("-");
        const values = [
          new Date(left.start_time ?? "").getTime(),
          new Date(right.start_time ?? "").getTime(),
        ];
        const comparison = compareValues(values[0], values[1], locale);
        return descending ? -comparison : comparison;
      }),
    [executions, locale, sort],
  );

  const allItems = tab === "policies" ? sortedPolicies : sortedExecutions;
  const pagedItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  const pagination = { page, page_size: pageSize, total: allItems.length };
  const policyFilter = route.query.get("q") ?? "";
  const executionFilters = {
    policy_id: route.query.get("policy_id") ?? "",
    status: route.query.get("status") ?? "",
    trigger: route.query.get("trigger") ?? "",
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
      {!policies && !error ? (
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
              <div className="toolbar-spacer" />
              <label className="toolbar-field">
                <span>{t("排序")}</span>
                <UnifiedSelect
                  ariaLabel={t("排序")}
                  className="toolbar-select"
                  value={sort}
                  options={[
                    { value: "id", label: t("策略编号") },
                    { value: "-id", label: t("策略编号（倒序）") },
                    { value: "name", label: t("名称") },
                    { value: "-update_time", label: t("最近更新") },
                    { value: "update_time", label: t("最早更新") },
                  ]}
                  onChange={(nextSort) =>
                    navigate(
                      replicationPath("policies", 1, pageSize, {
                        q: policyFilter,
                        sort: nextSort === "id" ? "" : nextSort,
                      }),
                    )
                  }
                />
              </label>
              <label className="toolbar-field">
                <span>{t("每页")}</span>
                <UnifiedSelect
                  ariaLabel={t("每页条数")}
                  className="toolbar-select"
                  value={String(pageSize)}
                  options={[20, 50, 100].map((nextPageSize) => ({
                    value: String(nextPageSize),
                    label: `${String(nextPageSize)} ${t("条")}`,
                  }))}
                  onChange={(nextPageSize) =>
                    navigate(
                      replicationPath("policies", 1, Number(nextPageSize), {
                        q: policyFilter,
                        sort: sort === "id" ? "" : sort,
                      }),
                    )
                  }
                />
              </label>
            </form>
            <div className="table-scroll">
              {pagedItems.length ? (
                <table className="replication-policy-table">
                  <thead>
                    <tr>
                      <th>{t("策略")}</th>
                      <th>{t("方向")}</th>
                      <th>{t("远端仓库")}</th>
                      <th>{t("触发方式")}</th>
                      <th>{t("状态")}</th>
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
                        <td>
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
                        <td>{triggerLabel(policy.trigger?.type, t)}</td>
                        <td>
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
                              onClick={() => onAction({ kind: "run", policy })}
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
                <EmptyReplication
                  title="暂无复制策略"
                  description="创建策略后可以在实例间同步制品。"
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
                      <th>{t("执行编号")}</th>
                      <th>{t("策略")}</th>
                      <th>{t("触发方式")}</th>
                      <th>{t("状态")}</th>
                      <th>{t("任务统计")}</th>
                      <th>{t("开始时间")}</th>
                      <th>{t("耗时")}</th>
                      <th>{t("日志")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pagedItems as ReplicationExecution[]).map((execution) => {
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
                          <td>{triggerLabel(execution.trigger, t)}</td>
                          <td>
                            <StatusBadge status={execution.status} />
                          </td>
                          <td>
                            <span className="execution-counts">
                              <b className="success-text">
                                {formatNumber(execution.succeed, locale)}
                              </b>
                              <b className="danger-text">
                                {formatNumber(execution.failed, locale)}
                              </b>
                              <span>
                                {formatNumber(execution.in_progress, locale)}
                              </span>
                            </span>
                          </td>
                          <td>{formatDate(execution.start_time, locale)}</td>
                          <td>
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
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyReplication
                  title="暂无复制记录"
                  description="运行复制策略后，执行结果会显示在这里。"
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
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
