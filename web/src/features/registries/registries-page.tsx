import { ContentTransition } from "../../components/content-transition";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { controlApi, loadAllControlItems } from "../../app/api-client";
import { formatDate } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { Registry, RegistryAdapterInfo } from "../../app/models";
import { loadPreferences, savePreferences } from "../../app/preferences";
import {
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import { StatusBadge } from "../../components/status-badge";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import { ViewModeToggle } from "../../components/view-mode-toggle";

export type RegistryAction =
  | {
      kind: "create";
      adapters: string[];
      adapterInfos: Partial<Record<string, RegistryAdapterInfo>>;
    }
  | {
      kind: "edit";
      registry: Registry;
      adapters: string[];
      adapterInfos: Partial<Record<string, RegistryAdapterInfo>>;
    }
  | { kind: "delete"; registry: Registry };

function registryTypeLabel(value: string | undefined): string {
  return (
    {
      harbor: "Harbor",
      "docker-hub": "Docker Hub",
      "docker-registry": "Docker Registry",
      "aws-ecr": "AWS ECR",
      "azure-acr": "Azure ACR",
      "google-gcr": "Google GCR",
      "ali-acr": "阿里云 ACR",
      "huawei-SWR": "华为云 SWR",
      "tencent-tcr": "腾讯云 TCR",
      "volcengine-cr": "火山引擎 CR",
      "github-ghcr": "GitHub GHCR",
      gitlab: "GitLab",
      quay: "Quay",
      "jfrog-artifactory": "JFrog Artifactory",
    }[value ?? ""] ??
    value ??
    "通用仓库"
  );
}

async function loadAllRegistries(signal: AbortSignal): Promise<Registry[]> {
  const items = await loadAllControlItems<Registry>(
    "registries",
    { sort: "name" },
    signal,
  );
  return items.sort((left, right) =>
    (left.name ?? "").localeCompare(right.name ?? ""),
  );
}

function timestamp(value: string | undefined): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareRegistries(
  left: Registry,
  right: Registry,
  sort: string,
  locale: string,
): number {
  const descending = sort.startsWith("-");
  const field = sort.replace(/^-/, "");
  const comparison =
    field === "creation_time"
      ? timestamp(left.creation_time) - timestamp(right.creation_time)
      : (left[field as "name" | "type" | "status"] ?? "").localeCompare(
          right[field as "name" | "type" | "status"] ?? "",
          locale,
        );
  if (comparison) return descending ? -comparison : comparison;
  return (left.id ?? 0) - (right.id ?? 0);
}

export function RegistriesPage({
  demo,
  refreshing,
  onRefresh,
  onAction,
  onNotice,
}: {
  demo: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAction: (action: RegistryAction) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [registries, setRegistries] = useState<Registry[]>();
  const [adapters, setAdapters] = useState<string[]>([]);
  const [adapterInfos, setAdapterInfos] = useState<
    Partial<Record<string, RegistryAdapterInfo>>
  >({});
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [sort, setSort] = useState("name");
  const [preferences, setPreferences] = useState(loadPreferences);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setError("");
    void Promise.all([
      loadAllRegistries(controller.signal),
      controlApi
        .data<string[]>("registry-adapters", {}, controller.signal)
        .catch(() => []),
      controlApi
        .data<Record<string, RegistryAdapterInfo>>(
          "registry-adapter-infos",
          {},
          controller.signal,
        )
        .catch(() => ({})),
    ])
      .then(([registryItems, adapterItems, info]) => {
        if (requestVersion.current !== current) return;
        setRegistries(registryItems);
        setAdapters(adapterItems ?? []);
        setAdapterInfos(info ?? {});
      })
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
  }, [version]);

  function editAction(registry: Registry): RegistryAction {
    return { kind: "edit", registry, adapters, adapterInfos };
  }

  const sortedRegistries = useMemo(
    () =>
      [...(registries ?? [])].sort((left, right) =>
        compareRegistries(left, right, sort, locale),
      ),
    [locale, registries, sort],
  );

  function setViewMode(mode: "card" | "list") {
    const next = { ...preferences, registryView: mode };
    setPreferences(next);
    savePreferences(next);
  }

  return (
    <>
      <PageHeader
        title="远端仓库"
        subtitle={t("管理 Harbor 连接的远端镜像仓库")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || !registries}
              onRefresh={() => {
                reload();
                onRefresh();
              }}
            />
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() =>
                onAction({ kind: "create", adapters, adapterInfos })
              }
            >
              <Icon name="plus" />
              <span>{t("新建连接")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      {error ? (
        <ErrorView title="远端仓库载入失败" message={error} retry={reload} />
      ) : null}
      {!registries && !error ? (
        <section className="table-shell">
          <div className="loading-state">
            <div>
              <span className="spinner" />
            </div>
          </div>
        </section>
      ) : null}
      {registries && !registries.length ? (
        <section className="panel">
          <EmptyState
            title="暂无远端仓库"
            description="添加连接后可用于复制和代理缓存。"
            icon="database"
          />
        </section>
      ) : null}
      {registries?.length ? (
        <section className="table-shell registry-list-shell">
          <div className="table-toolbar registry-list-toolbar">
            <div className="toolbar-spacer" />
            <ViewModeToggle
              value={preferences.registryView}
              ariaLabel={t("远端仓库展示方式")}
              listLabel={t("列表视图")}
              cardLabel={t("卡片视图")}
              onChange={setViewMode}
            />
          </div>
          <ContentTransition mode={preferences.registryView}>
            {preferences.registryView === "card" ? (
              <div className="registry-grid control-registry-grid">
                {sortedRegistries.map((registry) => (
                  <RegistryCard
                    key={registry.id}
                    registry={registry}
                    onEdit={() => onAction(editAction(registry))}
                    onDelete={() => onAction({ kind: "delete", registry })}
                    onNotice={onNotice}
                  />
                ))}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table-stable registry-list-table">
                  <StableTableColumns
                    widths={["22%", "16%", "32%", "12%", "14%", "96px"]}
                  />
                  <thead>
                    <tr>
                      <SortableHeader
                        label="名称"
                        field="name"
                        currentSort={sort}
                        onSort={setSort}
                      />
                      <SortableHeader
                        label="类型"
                        field="type"
                        currentSort={sort}
                        onSort={setSort}
                      />
                      <th>{t("地址")}</th>
                      <SortableHeader
                        label="状态"
                        field="status"
                        className="table-cell-center"
                        currentSort={sort}
                        onSort={setSort}
                      />
                      <SortableHeader
                        label="创建时间"
                        field="creation_time"
                        className="table-cell-time"
                        descendingFirst
                        currentSort={sort}
                        onSort={setSort}
                      />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRegistries.map((registry) => (
                      <tr key={registry.id}>
                        <td>
                          <strong>{registry.name ?? t("未命名仓库")}</strong>
                        </td>
                        <td>{t(registryTypeLabel(registry.type))}</td>
                        <td>
                          <span className="registry-url" title={registry.url}>
                            {registry.url ?? t("未配置地址")}
                          </span>
                        </td>
                        <td className="table-cell-center">
                          <StatusBadge status={registry.status ?? "unknown"} />
                        </td>
                        <td className="table-cell-time">
                          {formatDate(registry.creation_time, locale)}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              title={t("测试连接")}
                              aria-label={t("测试连接")}
                              onClick={() =>
                                void pingRegistry(registry, onNotice)
                              }
                            >
                              <Icon name="refresh" />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              title={t("编辑")}
                              aria-label={t("编辑")}
                              onClick={() => onAction(editAction(registry))}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-button danger-icon"
                              type="button"
                              title={t("删除")}
                              aria-label={t("删除")}
                              onClick={() =>
                                onAction({ kind: "delete", registry })
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
              </div>
            )}
          </ContentTransition>
        </section>
      ) : null}
    </>
  );
}

async function pingRegistry(
  registry: Registry,
  onNotice: (message: string, error?: boolean) => void,
) {
  try {
    await controlApi.mutate("registry-ping", {}, "POST", { id: registry.id });
    onNotice("远端仓库连接正常");
  } catch (pingError: unknown) {
    onNotice(
      pingError instanceof Error ? pingError.message : String(pingError),
      true,
    );
  }
}

function RegistryCard({
  registry,
  onEdit,
  onDelete,
  onNotice,
}: {
  registry: Registry;
  onEdit: () => void;
  onDelete: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <article className="registry-item">
      <div className="registry-top">
        <span className="registry-icon">
          <Icon name="database" />
        </span>
        <StatusBadge status={registry.status ?? "unknown"} />
      </div>
      <h3>{registry.name ?? t("未命名仓库")}</h3>
      <span className="registry-url" title={registry.url}>
        {registry.url ?? t("未配置地址")}
      </span>
      <div className="registry-meta">
        <span>{t(registryTypeLabel(registry.type))}</span>
        <span>#{registry.id ?? "-"}</span>
      </div>
      <div className="registry-actions">
        <button
          className="button button-small"
          type="button"
          onClick={() => void pingRegistry(registry, onNotice)}
        >
          <Icon name="refresh" />
          <span>{t("测试连接")}</span>
        </button>
        <div className="row-actions">
          <button
            className="icon-button"
            type="button"
            title={t("编辑")}
            aria-label={t("编辑")}
            onClick={onEdit}
          >
            <Icon name="edit" />
          </button>
          <button
            className="icon-button danger-icon"
            type="button"
            title={t("删除")}
            aria-label={t("删除")}
            onClick={onDelete}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </article>
  );
}
