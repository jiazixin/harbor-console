import { useState } from "react";
import { controlApi, loadAllControlItems } from "../../app/api-client";
import { errorText } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { Registry, RegistryAdapterInfo } from "../../app/models";
import { optionalData } from "../../app/optional-data";
import {
  displayTimeZone,
  loadPreferences,
  savePreferences,
} from "../../app/preferences";
import {
  type ControlMutate,
  useControlMutation,
} from "../../app/use-control-mutation";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { ContentTransition } from "../../components/content-transition";
import { DemoBanner } from "../../components/demo-banner";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { RefreshButton } from "../../components/refresh-button";
import uiStyles0 from "../../components/shared-ui.module.css";
import { SortableHeader } from "../../components/sortable-header";
import { StableTableColumns } from "../../components/stable-table-columns";
import { StatusBadge } from "../../components/status-badge";
import { ViewModeToggle } from "../../components/view-mode-toggle";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate } from "../../lib/format/formatters";
import styles from "./registries.module.css";
import { registryKeys } from "./registry-keys";

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

function compareRegistries({
  left,
  right,
  sort,
  locale,
}: {
  left: Registry;
  right: Registry;
  sort: string;
  locale: string;
}): number {
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

type RegistriesPageProps = {
  demo: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAction: (action: RegistryAction) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function RegistriesPage({
  demo,
  refreshing,
  onRefresh,
  onAction,
  onNotice,
}: RegistriesPageProps) {
  const mutate = useControlMutation([]);
  const { locale, t } = useLocale();
  const registriesQuery = useRegistriesData();
  const [registries, adapterItems, info] = registriesQuery.data ?? [];
  const adapters = adapterItems?.data ?? [];
  const adapterInfos: Partial<Record<string, RegistryAdapterInfo>> =
    info?.data ?? {};
  const error = [registriesQuery.error, adapterItems?.error, info?.error]
    .filter(Boolean)
    .join("；");
  const reload = registriesQuery.reload;
  const [sort, setSort] = useState("name");
  const [preferences, setPreferences] = useState(loadPreferences);

  function editAction(registry: Registry): RegistryAction {
    return { kind: "edit", registry, adapters, adapterInfos };
  }

  const sortedRegistries = (() =>
    [...(registries ?? [])].sort((left, right) =>
      compareRegistries({
        left: left,
        right: right,
        sort: sort,
        locale: locale,
      }),
    ))();

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
              className={resolveClasses("button button-small button-primary")}
              type="button"
              onClick={() => {
                onAction({ kind: "create", adapters, adapterInfos });
              }}
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
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("loading-state")}>
            <div>
              <span className={resolveClasses("spinner")} />
            </div>
          </div>
        </section>
      ) : null}
      {registries && !registries.length ? (
        <section className={resolveClasses("panel")}>
          <EmptyState
            title="暂无远端仓库"
            description="添加连接后可用于复制和代理缓存。"
            icon="database"
          />
        </section>
      ) : null}
      {registries?.length ? (
        <section
          className={resolveClasses(`table-shell ${styles.registryListShell}`)}
        >
          <div
            className={resolveClasses(
              `table-toolbar ${styles.registryListToolbar}`,
            )}
          >
            <div className={resolveClasses("toolbar-spacer")} />
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
              <div
                className={resolveClasses(
                  `${styles.registryGrid} ${styles.controlRegistryGrid}`,
                )}
              >
                {sortedRegistries.map((registry) => (
                  <RegistryCard
                    key={registry.id}
                    registry={registry}
                    onEdit={() => {
                      onAction(editAction(registry));
                    }}
                    onDelete={() => {
                      onAction({ kind: "delete", registry });
                    }}
                    onNotice={onNotice}
                  />
                ))}
              </div>
            ) : (
              <div className={resolveClasses("table-scroll")}>
                <table
                  className={resolveClasses(
                    `data-table-stable ${styles.registryListTable}`,
                  )}
                >
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
                        className={resolveClasses("table-cell-center")}
                        currentSort={sort}
                        onSort={setSort}
                      />
                      <SortableHeader
                        label="创建时间"
                        field="creation_time"
                        className={resolveClasses("table-cell-time")}
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
                          <span
                            className={resolveClasses(styles.registryUrl)}
                            title={registry.url}
                          >
                            {registry.url ?? t("未配置地址")}
                          </span>
                        </td>
                        <td className={resolveClasses("table-cell-center")}>
                          <StatusBadge status={registry.status ?? "unknown"} />
                        </td>
                        <td className={resolveClasses("table-cell-time")}>
                          {formatDate(registry.creation_time, {
                            locale: locale,
                            timeZone: displayTimeZone(),
                          })}
                        </td>
                        <td>
                          <div className={resolveClasses("row-actions")}>
                            <button
                              className={resolveClasses("icon-button")}
                              type="button"
                              title={t("测试连接")}
                              aria-label={t("测试连接")}
                              onClick={() =>
                                void pingRegistry(registry, onNotice, mutate)
                              }
                            >
                              <Icon name="refresh" />
                            </button>
                            <button
                              className={resolveClasses("icon-button")}
                              type="button"
                              title={t("编辑")}
                              aria-label={t("编辑")}
                              onClick={() => {
                                onAction(editAction(registry));
                              }}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className={resolveClasses(
                                "icon-button danger-icon",
                              )}
                              type="button"
                              title={t("删除")}
                              aria-label={t("删除")}
                              onClick={() => {
                                onAction({ kind: "delete", registry });
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
  mutate: ControlMutate,
) {
  try {
    await mutate({
      operation: "registry-ping",
      parameters: {},
      method: "POST",
      payload: { id: registry.id },
    });
    onNotice("远端仓库连接正常");
  } catch (pingError: unknown) {
    onNotice(errorText(pingError), true);
  }
}

type RegistryCardProps = {
  registry: Registry;
  onEdit: () => void;
  onDelete: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

function RegistryCard({
  registry,
  onEdit,
  onDelete,
  onNotice,
}: RegistryCardProps) {
  const mutate = useControlMutation([]);
  const { t } = useLocale();
  return (
    <article className={resolveClasses(styles.registryItem)}>
      <div className={resolveClasses(styles.registryTop)}>
        <span className={resolveClasses(styles.registryIcon)}>
          <Icon name="database" />
        </span>
        <StatusBadge status={registry.status ?? "unknown"} />
      </div>
      <h3>{registry.name ?? t("未命名仓库")}</h3>
      <span className={resolveClasses(styles.registryUrl)} title={registry.url}>
        {registry.url ?? t("未配置地址")}
      </span>
      <div className={resolveClasses(styles.registryMeta)}>
        <span>{t(registryTypeLabel(registry.type))}</span>
        <span>#{registry.id ?? "-"}</span>
      </div>
      <div className={resolveClasses(styles.registryActions)}>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={() => void pingRegistry(registry, onNotice, mutate)}
        >
          <Icon name="refresh" />
          <span>{t("测试连接")}</span>
        </button>
        <div className={resolveClasses("row-actions")}>
          <button
            className={resolveClasses("icon-button")}
            type="button"
            title={t("编辑")}
            aria-label={t("编辑")}
            onClick={onEdit}
          >
            <Icon name="edit" />
          </button>
          <button
            className={resolveClasses("icon-button danger-icon")}
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

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "status-badge": uiStyles0.statusBadge,
  "view-mode-toggle": uiStyles0.viewModeToggle,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-shell": uiStyles0.tableShell,
  "loading-state": uiStyles0.loadingState,
  spinner: uiStyles0.spinner,
  panel: uiStyles0.panel,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  "table-scroll": uiStyles0.tableScroll,
  "data-table-stable": uiStyles0.dataTableStable,
  "table-cell-center": uiStyles0.tableCellCenter,
  "table-cell-time": uiStyles0.tableCellTime,
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

function useRegistriesData() {
  return useLoadedQuery(registryKeys.page, (signal) =>
    Promise.all([
      loadAllRegistries(signal),
      optionalData(controlApi.data<string[]>("registry-adapters", {}, signal)),
      optionalData(
        controlApi.data<Record<string, RegistryAdapterInfo>>(
          "registry-adapter-infos",
          {},
          signal,
        ),
      ),
    ]),
  );
}
