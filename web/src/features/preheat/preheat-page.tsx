import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { formatNumber, formatCount } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  PreheatInstance,
  PreheatProviderMetadata,
} from "../../app/models";
import { ErrorView, LoadingView } from "../../components/feedback";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  PanelTitle,
} from "../../components/page-elements";
import { StatusBadge } from "../../components/status-badge";

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

export function PreheatPage({
  demo,
  refreshing,
  onRefresh,
  onAction,
  onNotice,
}: {
  demo: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAction: (action: PreheatInstanceAction) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [providers, setProviders] = useState<PreheatProviderMetadata[]>();
  const [instances, setInstances] = useState<PreheatInstance[]>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fatalError, setFatalError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const currentVersion = requestVersion.current + 1;
    requestVersion.current = currentVersion;
    setLoading(true);
    setWarnings([]);
    setFatalError("");
    void Promise.allSettled([
      controlApi.data<PreheatProviderMetadata[]>(
        "preheat-providers",
        {},
        controller.signal,
      ),
      controlApi.list<PreheatInstance>(
        "preheat-instances",
        { page: 1, page_size: 100, sort: "name" },
        controller.signal,
      ),
    ])
      .then(([providerResult, instanceResult]) => {
        if (
          controller.signal.aborted ||
          requestVersion.current !== currentVersion
        )
          return;
        const errors = [providerResult, instanceResult].flatMap((result) => {
          if (result.status !== "rejected") return [];
          return [
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          ];
        });
        if (errors.length === 2) {
          setFatalError([...new Set(errors)].join("；"));
          setProviders([]);
          setInstances([]);
          return;
        }
        setProviders(
          providerResult.status === "fulfilled"
            ? (providerResult.value ?? [])
            : [],
        );
        setInstances(
          instanceResult.status === "fulfilled"
            ? instanceResult.value.items
            : [],
        );
        setWarnings(errors);
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          requestVersion.current === currentVersion
        ) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [version]);

  async function ping(instance: PreheatInstance) {
    try {
      await controlApi.mutate("preheat-instance-ping", {}, "POST", {
        id: instance.id,
      });
      onNotice("P2P Provider 连接正常");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), true);
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
              className="button button-small button-primary"
              type="button"
              disabled={!providerItems.length}
              onClick={() =>
                onAction({ kind: "create", providers: providerItems })
              }
            >
              <Icon name="plus" />
              <span>{t("新建实例")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      {initialLoading ? (
        <section className="table-shell">
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
            <div className="notice notice-warning preheat-warning">
              <Icon name="alert" />
              <span>{warnings.join("；")}</span>
            </div>
          ) : null}
          <section className="preheat-provider-band">
            <div>
              <span className="eyebrow">{t("官方 Provider")}</span>
              <h2>
                {locale === "en-US"
                  ? `${formatNumber(providerItems.length, locale)} providers available`
                  : `${formatNumber(providerItems.length, locale)} 种驱动可用`}
              </h2>
            </div>
            <div className="preheat-provider-list">
              {providerItems.length ? (
                providerItems.map((provider) => (
                  <span className="preheat-provider-badge" key={provider.id}>
                    <span className="cell-icon">
                      <Icon name="play" />
                    </span>
                    <span>
                      <strong>{providerName(provider)}</strong>
                    </span>
                  </span>
                ))
              ) : (
                <span className="muted">
                  {t("当前实例未返回 Provider 元数据")}
                </span>
              )}
            </div>
          </section>
          <section className="table-shell">
            <div className="table-toolbar">
              <PanelTitle
                title="P2P Provider 实例"
                count={formatCount(
                  instanceItems.length,
                  locale,
                  "个实例",
                  instanceItems.length === 1 ? "instance" : "instances",
                )}
              />
            </div>
            <div className="table-scroll">
              {!instanceItems.length ? (
                <EmptyState
                  title="暂无 P2P 实例"
                  description="注册 Dragonfly、Kraken 等 Provider 实例后，项目即可创建预热策略。"
                  icon="play"
                />
              ) : (
                <table className="preheat-instance-table">
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
                          <div className="cell-title">
                            <span className="cell-icon">
                              <Icon name="play" />
                            </span>
                            <span className="cell-stack">
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
                          <span className="badge badge-blue">
                            {instance.vendor || "-"}
                          </span>
                        </td>
                        <td
                          className="truncate-cell mono"
                          title={instance.endpoint}
                        >
                          {instance.endpoint || "-"}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              (instance.auth_mode ?? "NONE").toUpperCase() ===
                              "NONE"
                                ? ""
                                : "badge-blue"
                            }`.trim()}
                          >
                            {t(authModeLabel(instance.auth_mode))}
                          </span>
                        </td>
                        <td>
                          {instance.enabled === false ? (
                            <span className="badge">{t("已停用")}</span>
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
                            <span className="badge badge-orange">
                              {t("默认")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              title={t("测试连接")}
                              aria-label={t("测试连接")}
                              onClick={() => void ping(instance)}
                            >
                              <Icon name="refresh" />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              title={t("编辑实例")}
                              aria-label={t("编辑实例")}
                              onClick={() =>
                                onAction({
                                  kind: "edit",
                                  instance,
                                  providers: providerItems,
                                })
                              }
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-button danger-icon"
                              type="button"
                              title={t("删除实例")}
                              aria-label={t("删除实例")}
                              onClick={() =>
                                onAction({ kind: "delete", instance })
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
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
