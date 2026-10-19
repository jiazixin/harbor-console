import { useMemo } from "react";

import { formatDate } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  PreheatFilter,
  PreheatPolicy,
  PreheatProvider,
  PreheatTrigger,
} from "../../app/models";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { useResettableState } from "../../components/use-resettable-state";

export type ProjectPreheatAction =
  | {
      kind: "create";
      project: string;
      projectId: number;
      providers: PreheatProvider[];
    }
  | {
      kind: "edit";
      project: string;
      projectId: number;
      providers: PreheatProvider[];
      policy: PreheatPolicy;
    }
  | { kind: "delete"; project: string; policy: PreheatPolicy }
  | { kind: "run"; project: string; policy: PreheatPolicy }
  | { kind: "executions"; project: string; policy: PreheatPolicy };

function parseJson<T>(value: string | T | undefined, fallback: T): T {
  if (value !== undefined && typeof value !== "string") return value;
  try {
    return JSON.parse(typeof value === "string" ? value : "") as T;
  } catch {
    return fallback;
  }
}

function triggerLabel(trigger: PreheatTrigger): string {
  return (
    {
      manual: "手动",
      scheduled: "定时",
      event_based: "事件触发",
      "scheduled(paused)": "定时已暂停",
    }[trigger.type ?? ""] ??
    trigger.type ??
    "手动"
  );
}

function filterLabel(type: string | undefined): string {
  return (
    {
      repository: "仓库",
      tag: "Tag",
      label: "标签",
      signature: "签名",
      vulnerability: "漏洞",
    }[type ?? ""] ??
    type ??
    "筛选"
  );
}

export function ProjectPreheatSection({
  project,
  projectId,
  policies,
  providers,
  pagination,
  initialQuery,
  errors,
  onSearch,
  onPageChange,
  onAction,
}: {
  project: string;
  projectId: number;
  policies: PreheatPolicy[];
  providers: PreheatProvider[];
  pagination: ControlPagination;
  initialQuery: string;
  errors: string[];
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  onAction: (action: ProjectPreheatAction) => void;
}) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useResettableState(initialQuery);
  const providerNames = useMemo(
    () =>
      new Map(
        providers.map((provider) => [
          provider.id,
          provider.provider ?? `Provider #${String(provider.id)}`,
        ]),
      ),
    [providers],
  );

  return (
    <div className="preheat-project-layout">
      {errors.length ? (
        <div className="notice notice-warning preheat-warning">
          <Icon name="alert" />
          <span>{errors.join("；")}</span>
        </div>
      ) : null}
      {!providers.length ? (
        <section className="preheat-missing-provider">
          <div>
            <h2>{t("没有可用的 P2P Provider 实例")}</h2>
            <p>{t("系统管理员需要先注册并启用分布式分发实例。")}</p>
          </div>
          <a className="button button-small" href="#/preheat">
            <Icon name="arrow-right" />
            <span>{t("前往 P2P 分发")}</span>
          </a>
        </section>
      ) : null}
      <section className="table-shell">
        <div className="table-toolbar">
          <ToolbarSearchForm
            placeholder="按策略名称搜索"
            value={query}
            onChange={setQuery}
            onSubmit={onSearch}
          />
          <div className="toolbar-spacer" />
          <button
            className="button button-small button-primary"
            type="button"
            disabled={!providers.length}
            onClick={() =>
              onAction({ kind: "create", project, projectId, providers })
            }
          >
            <Icon name="plus" />
            <span>{t("新建预热策略")}</span>
          </button>
        </div>
        <div className="table-scroll">
          {!policies.length ? (
            <EmptyState
              title="暂无预热策略"
              description="创建策略后可按仓库、Tag 和标签将镜像预热到 P2P 节点。"
              icon="play"
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("策略")}</th>
                  <th>Provider</th>
                  <th>{t("筛选范围")}</th>
                  <th>{t("触发方式")}</th>
                  <th>{t("状态")}</th>
                  <th className="table-cell-time">{t("最近更新")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, policyIndex) => {
                  const trigger = parseJson<PreheatTrigger>(policy.trigger, {});
                  const filters = parseJson<PreheatFilter[]>(
                    policy.filters,
                    [],
                  );
                  return (
                    <tr key={`${String(policy.id)}-${String(policyIndex)}`}>
                      <td>
                        <div className="cell-title">
                          <span className="cell-icon">
                            <Icon name="play" />
                          </span>
                          <span className="cell-stack">
                            <strong>{policy.name}</strong>
                            <small>
                              {policy.description
                                ? t(policy.description)
                                : `${t("策略")} #${String(policy.id)}`}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-blue">
                          {providerNames.get(policy.provider_id ?? 0) ??
                            `#${String(policy.provider_id ?? "-")}`}
                        </span>
                      </td>
                      <td>
                        <span className="preheat-filter-list">
                          {filters.length ? (
                            filters.slice(0, 3).map((filter, filterIndex) => (
                              <span
                                className="badge"
                                key={`${filter.type ?? "filter"}-${String(filterIndex)}`}
                              >
                                <b>{t(filterLabel(filter.type))}</b>{" "}
                                {filter.value ?? ""}
                              </span>
                            ))
                          ) : (
                            <span className="badge">{t("无筛选")}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="cell-stack">
                          <strong>{t(triggerLabel(trigger))}</strong>
                          <small className="mono">
                            {trigger.trigger_setting?.cron ?? "-"}
                          </small>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${policy.enabled ? "badge-green" : ""}`.trim()}
                        >
                          {t(policy.enabled ? "已启用" : "已停用")}
                        </span>
                      </td>
                      <td className="table-cell-time">
                        {formatDate(
                          policy.update_time ?? policy.creation_time,
                          locale,
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            disabled={!policy.enabled}
                            title={t("立即预热")}
                            aria-label={t("立即预热")}
                            onClick={() =>
                              onAction({ kind: "run", project, policy })
                            }
                          >
                            <Icon name="play" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            title={t("执行记录")}
                            aria-label={t("执行记录")}
                            onClick={() =>
                              onAction({ kind: "executions", project, policy })
                            }
                          >
                            <Icon name="history" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            title={t("编辑策略")}
                            aria-label={t("编辑策略")}
                            onClick={() =>
                              onAction({
                                kind: "edit",
                                project,
                                projectId,
                                providers,
                                policy,
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
                              onAction({ kind: "delete", project, policy })
                            }
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
          )}
        </div>
        <Pagination pagination={pagination} onPageChange={onPageChange} />
      </section>
    </div>
  );
}
