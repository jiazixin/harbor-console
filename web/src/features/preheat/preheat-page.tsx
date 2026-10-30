import { controlApi } from "../../app/api-client";
import { errorText } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
  PreheatInstance,
  PreheatProviderMetadata,
} from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { DemoBanner } from "../../components/demo-banner";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { LoadingView } from "../../components/loading-view";
import { PageHeader } from "../../components/page-header";
import { PanelTitle } from "../../components/panel-title";
import { RefreshButton } from "../../components/refresh-button";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatusBadge } from "../../components/status-badge";
import { createClassNames } from "../../lib/css/class-names";
import { formatCount, formatNumber } from "../../lib/format/formatters";
import { preheatKeys } from "./preheat-keys";
import styles from "./preheat.module.css";

// Queries that a write in this module can change.
const affectedQueries = [preheatKeys.all];

export type PreheatInstanceAction =
  | { kind: "create"; providers: PreheatProviderMetadata[] }
  | {
      kind: "edit";
      instance: PreheatInstance;
      providers: PreheatProviderMetadata[];
    }
  | { kind: "delete"; instance: PreheatInstance };

function authModeLabel(value: string | undefined): string {
  const normalized = value?.toUpperCase() ?? "NONE";
  if (normalized === "BASIC") return "用户名密码";
  if (normalized === "OAUTH") return "OAuth Token";
  return "无认证";
}

function providerName(provider: PreheatProviderMetadata): string {
  return provider.name?.trim() ? provider.name.trim() : provider.id;
}

type PreheatData = {
  providers: PreheatProviderMetadata[];
  instances: PreheatInstance[];
  /** Failures of one of the two loads; the other still shows. */
  warnings: string[];
  /** Set when both loads failed. */
  fatalError: string;
};

async function loadPreheatData(signal: AbortSignal): Promise<PreheatData> {
  const [providerResult, instanceResult] = await Promise.allSettled([
    controlApi.data<PreheatProviderMetadata[]>("preheat-providers", {}, signal),
    controlApi.list<PreheatInstance>(
      "preheat-instances",
      { page: 1, page_size: 100, sort: "name" },
      signal,
    ),
  ]);
  const errors = [providerResult, instanceResult].flatMap((result) => {
    if (result.status !== "rejected") return [];
    return [errorText(result.reason)];
  });
  if (errors.length === 2) {
    return {
      providers: [],
      instances: [],
      warnings: [],
      fatalError: [...new Set(errors)].join("；"),
    };
  }
  return {
    providers:
      providerResult.status === "fulfilled" ? (providerResult.value ?? []) : [],
    instances:
      instanceResult.status === "fulfilled" ? instanceResult.value.items : [],
    warnings: errors,
    fatalError: "",
  };
}

type PreheatPageProps = {
  demo: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAction: (action: PreheatInstanceAction) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function PreheatPage({
  demo,
  refreshing,
  onRefresh,
  onAction,
  onNotice,
}: PreheatPageProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const preheatQuery = usePreheatData();
  const providers = preheatQuery.data?.providers;
  const instances = preheatQuery.data?.instances;
  const warnings = preheatQuery.data?.warnings ?? [];
  const fatalError = preheatQuery.data?.fatalError ?? "";
  const loading = preheatQuery.loading;
  const reload = preheatQuery.reload;

  async function ping(instance: PreheatInstance) {
    try {
      await mutate({
        operation: "preheat-instance-ping",
        parameters: {},
        method: "POST",
        payload: {
          id: instance.id,
        },
      });
      onNotice("P2P Provider 连接正常");
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }

  const providerItems = providers ?? [];
  const instanceItems = instances ?? [];
  const initialLoading =
    loading && providers === undefined && instances === undefined;

  return (
    <>
      <PageHeader
        title="P2P 分发"
        subtitle={t("管理分布式分发 Provider 与预热实例")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => {
                reload();
                onRefresh();
              }}
            />
            <button
              className={resolveClasses("button button-small button-primary")}
              type="button"
              disabled={!providerItems.length}
              onClick={() => {
                onAction({ kind: "create", providers: providerItems });
              }}
            >
              <Icon name="plus" />
              <span>{t("新建实例")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      {initialLoading ? (
        <section className={resolveClasses("table-shell")}>
          <LoadingView />
        </section>
      ) : null}
      {!initialLoading && fatalError ? (
        <ErrorView
          title="P2P 分发载入失败"
          message={`${fatalError}。${t("当前 Harbor 版本可能未启用分布式分发模块，或当前账号没有系统级预热实例权限。")}`}
          retry={reload}
        />
      ) : null}
      {!fatalError && providers !== undefined && instances !== undefined ? (
        <div aria-busy={loading}>
          {warnings.length ? (
            <div
              className={resolveClasses(
                "notice notice-warning preheat-warning",
              )}
            >
              <Icon name="alert" />
              <span>{warnings.join("；")}</span>
            </div>
          ) : null}
          <section className={resolveClasses(styles.preheatProviderBand)}>
            <div>
              <span className={resolveClasses("eyebrow")}>
                {t("官方 Provider")}
              </span>
              <h2>
                {locale === "en-US"
                  ? `${formatNumber(providerItems.length, locale)} providers available`
                  : `${formatNumber(providerItems.length, locale)} 种驱动可用`}
              </h2>
            </div>
            <div className={resolveClasses(styles.preheatProviderList)}>
              {providerItems.length ? (
                providerItems.map((provider) => (
                  <span
                    className={resolveClasses(styles.preheatProviderBadge)}
                    key={provider.id}
                  >
                    <span className={resolveClasses("cell-icon")}>
                      <Icon name="play" />
                    </span>
                    <span>
                      <strong>{providerName(provider)}</strong>
                    </span>
                  </span>
                ))
              ) : (
                <span className={resolveClasses("muted")}>
                  {t("当前实例未返回 Provider 元数据")}
                </span>
              )}
            </div>
          </section>
          <section className={resolveClasses("table-shell")}>
            <div className={resolveClasses("table-toolbar")}>
              <PanelTitle
                title="P2P Provider 实例"
                count={formatCount({
                  total: instanceItems.length,
                  locale: locale,
                  chineseUnit: "个实例",
                  englishUnit:
                    instanceItems.length === 1 ? "instance" : "instances",
                })}
              />
            </div>
            <div className={resolveClasses("table-scroll")}>
              {!instanceItems.length ? (
                <EmptyState
                  title="暂无 P2P 实例"
                  description="注册 Dragonfly、Kraken 等 Provider 实例后，项目即可创建预热策略。"
                  icon="play"
                />
              ) : (
                <table className={resolveClasses("preheat-instance-table")}>
                  <thead>
                    <tr>
                      <th>{t("实例")}</th>
                      <th>Provider</th>
                      <th>{t("地址")}</th>
                      <th>{t("认证")}</th>
                      <th>{t("状态")}</th>
                      <th>{t("默认")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {instanceItems.map((instance) => (
                      <tr key={instance.id}>
                        <td>
                          <div className={resolveClasses("cell-title")}>
                            <span className={resolveClasses("cell-icon")}>
                              <Icon name="play" />
                            </span>
                            <span className={resolveClasses("cell-stack")}>
                              <strong>{instance.name}</strong>
                              <small>
                                {instance.description
                                  ? t(instance.description)
                                  : t("暂无描述")}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={resolveClasses("badge badge-blue")}>
                            {instance.vendor || "-"}
                          </span>
                        </td>
                        <td
                          className={resolveClasses("truncate-cell mono")}
                          title={instance.endpoint}
                        >
                          {instance.endpoint || "-"}
                        </td>
                        <td>
                          <span
                            className={resolveClasses(
                              `badge ${
                                (instance.auth_mode ?? "NONE").toUpperCase() ===
                                "NONE"
                                  ? ""
                                  : "badge-blue"
                              }`.trim(),
                            )}
                          >
                            {t(authModeLabel(instance.auth_mode))}
                          </span>
                        </td>
                        <td>
                          {instance.enabled === false ? (
                            <span className={resolveClasses("badge")}>
                              {t("已停用")}
                            </span>
                          ) : (
                            <StatusBadge
                              status={instance.status}
                              label={
                                instance.status?.toLowerCase() === "healthy"
                                  ? "正常"
                                  : undefined
                              }
                            />
                          )}
                        </td>
                        <td>
                          {instance.default ? (
                            <span
                              className={resolveClasses("badge badge-orange")}
                            >
                              {t("默认")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <div className={resolveClasses("row-actions")}>
                            <button
                              className={resolveClasses("icon-button")}
                              type="button"
                              title={t("测试连接")}
                              aria-label={t("测试连接")}
                              onClick={() => void ping(instance)}
                            >
                              <Icon name="refresh" />
                            </button>
                            <button
                              className={resolveClasses("icon-button")}
                              type="button"
                              title={t("编辑实例")}
                              aria-label={t("编辑实例")}
                              onClick={() => {
                                onAction({
                                  kind: "edit",
                                  instance,
                                  providers: providerItems,
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
                              title={t("删除实例")}
                              aria-label={t("删除实例")}
                              onClick={() => {
                                onAction({ kind: "delete", instance });
                              }}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "panel-title": uiStyles0.panelTitle,
  "refresh-button": uiStyles0.refreshButton,
  "status-badge": uiStyles0.statusBadge,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-shell": uiStyles0.tableShell,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "preheat-warning": uiStyles0.preheatWarning,
  eyebrow: uiStyles0.eyebrow,
  "cell-icon": uiStyles0.cellIcon,
  muted: uiStyles0.muted,
  "table-toolbar": uiStyles0.tableToolbar,
  "table-scroll": uiStyles0.tableScroll,
  "cell-title": uiStyles0.cellTitle,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "truncate-cell": uiStyles0.truncateCell,
  mono: uiStyles0.mono,
  "badge-orange": uiStyles0.badgeOrange,
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

function usePreheatData() {
  return useLoadedQuery(preheatKeys.instances, (signal) =>
    loadPreheatData(signal),
  );
}
