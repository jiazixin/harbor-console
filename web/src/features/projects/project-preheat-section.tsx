import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  PreheatPolicy,
  PreheatProvider,
  PreheatTrigger,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { Pagination } from "../../components/pagination";
import uiStyles0 from "../../components/shared-ui.module.css";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate } from "../../lib/format/formatters";
import { useResettableState } from "../../lib/state/use-resettable-state";
import { preheatFilters, preheatTrigger } from "./preheat-schema";
import styles from "./projects.module.css";

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

type ProjectPreheatSectionProps = {
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
};

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
}: ProjectPreheatSectionProps) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useResettableState(initialQuery);
  const providerNames = (() =>
    new Map(
      providers.map((provider) => [
        provider.id,
        provider.provider ?? `Provider #${String(provider.id)}`,
      ]),
    ))();

  return (
    <div className={resolveClasses(styles.preheatProjectLayout)}>
      {errors.length ? (
        <div
          className={resolveClasses("notice notice-warning preheat-warning")}
        >
          <Icon name="alert" />
          <span>{errors.join("；")}</span>
        </div>
      ) : null}
      {!providers.length ? (
        <section className={resolveClasses(styles.preheatMissingProvider)}>
          <div>
            <h2>{t("没有可用的 P2P Provider 实例")}</h2>
            <p>{t("系统管理员需要先注册并启用分布式分发实例。")}</p>
          </div>
          <a className={resolveClasses("button button-small")} href="#/preheat">
            <Icon name="arrow-right" />
            <span>{t("前往 P2P 分发")}</span>
          </a>
        </section>
      ) : null}
      <section className={resolveClasses("table-shell")}>
        <div className={resolveClasses("table-toolbar")}>
          <ToolbarSearchForm
            placeholder="按策略名称搜索"
            value={query}
            onChange={setQuery}
            onSubmit={onSearch}
          />
          <div className={resolveClasses("toolbar-spacer")} />
          <button
            className={resolveClasses("button button-small button-primary")}
            type="button"
            disabled={!providers.length}
            onClick={() => {
              onAction({ kind: "create", project, projectId, providers });
            }}
          >
            <Icon name="plus" />
            <span>{t("新建预热策略")}</span>
          </button>
        </div>
        <div className={resolveClasses("table-scroll")}>
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
                  <th className={resolveClasses("table-cell-time")}>
                    {t("最近更新")}
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, policyIndex) => {
                  const trigger = preheatTrigger(policy.trigger);
                  const filters = preheatFilters(policy.filters);
                  return (
                    <tr key={`${String(policy.id)}-${String(policyIndex)}`}>
                      <td>
                        <div className={resolveClasses("cell-title")}>
                          <span className={resolveClasses("cell-icon")}>
                            <Icon name="play" />
                          </span>
                          <span className={resolveClasses("cell-stack")}>
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
                        <span className={resolveClasses("badge badge-blue")}>
                          {providerNames.get(policy.provider_id ?? 0) ??
                            `#${String(policy.provider_id ?? "-")}`}
                        </span>
                      </td>
                      <td>
                        <span
                          className={resolveClasses(styles.preheatFilterList)}
                        >
                          {filters.length ? (
                            filters.slice(0, 3).map((filter, filterIndex) => (
                              <span
                                className={resolveClasses("badge")}
                                key={`${filter.type ?? "filter"}-${String(filterIndex)}`}
                              >
                                <b>{t(filterLabel(filter.type))}</b>{" "}
                                {filter.value ?? ""}
                              </span>
                            ))
                          ) : (
                            <span className={resolveClasses("badge")}>
                              {t("无筛选")}
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={resolveClasses("cell-stack")}>
                          <strong>{t(triggerLabel(trigger))}</strong>
                          <small className={resolveClasses("mono")}>
                            {trigger.trigger_setting?.cron ?? "-"}
                          </small>
                        </span>
                      </td>
                      <td>
                        <span
                          className={resolveClasses(
                            `badge ${policy.enabled ? "badge-green" : ""}`.trim(),
                          )}
                        >
                          {t(policy.enabled ? "已启用" : "已停用")}
                        </span>
                      </td>
                      <td className={resolveClasses("table-cell-time")}>
                        {formatDate(
                          policy.update_time ?? policy.creation_time,
                          { locale: locale, timeZone: displayTimeZone() },
                        )}
                      </td>
                      <td>
                        <div className={resolveClasses("row-actions")}>
                          <button
                            className={resolveClasses("icon-button")}
                            type="button"
                            disabled={!policy.enabled}
                            title={t("立即预热")}
                            aria-label={t("立即预热")}
                            onClick={() => {
                              onAction({ kind: "run", project, policy });
                            }}
                          >
                            <Icon name="play" />
                          </button>
                          <button
                            className={resolveClasses("icon-button")}
                            type="button"
                            title={t("执行记录")}
                            aria-label={t("执行记录")}
                            onClick={() => {
                              onAction({ kind: "executions", project, policy });
                            }}
                          >
                            <Icon name="history" />
                          </button>
                          <button
                            className={resolveClasses("icon-button")}
                            type="button"
                            title={t("编辑策略")}
                            aria-label={t("编辑策略")}
                            onClick={() => {
                              onAction({
                                kind: "edit",
                                project,
                                projectId,
                                providers,
                                policy,
                              });
                            }}
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className={resolveClasses(
                              "icon-button danger-icon",
                            )}
                            type="button"
                            title={t("删除策略")}
                            aria-label={t("删除策略")}
                            onClick={() => {
                              onAction({ kind: "delete", project, policy });
                            }}
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

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "preheat-warning": uiStyles0.preheatWarning,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  "button-primary": uiStyles0.buttonPrimary,
  "table-scroll": uiStyles0.tableScroll,
  "table-cell-time": uiStyles0.tableCellTime,
  "cell-title": uiStyles0.cellTitle,
  "cell-icon": uiStyles0.cellIcon,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  mono: uiStyles0.mono,
  "badge-green": uiStyles0.badgeGreen,
  "row-actions": uiStyles0.rowActions,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
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
