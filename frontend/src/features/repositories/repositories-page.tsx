import { ContentTransition } from "../../components/content-transition";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { loadAllControlItems } from "../../app/api-client";
import { formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  ProjectSummary,
  RepositorySummary,
  Session,
} from "../../app/models";
import { loadPreferences, savePreferences } from "../../app/preferences";
import {
  createSortValues,
  Pagination,
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  SectionHeading,
  StatCell,
} from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";
import { ViewModeToggle } from "../../components/view-mode-toggle";
import { compareRepositories, repositoryTimestamp } from "./repository-sorting";

const defaultPageSize = 50;
const defaultSort = "-artifact_count";
const validSorts = createSortValues([
  "artifact_count",
  "pull_count",
  "update_time",
  "creation_time",
  "name",
]);

type RepositoryAsset = RepositorySummary & { project_name: string };

type RepositoryRoute = {
  page: number;
  pageSize: number;
  query: string;
  project: string;
  sort: string;
};

type RepositoryData = {
  repositories: RepositoryAsset[];
  failures: string[];
};

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function displayRepositoryName(project: string, repository: string): string {
  const prefix = `${project}/`;
  return repository.startsWith(prefix)
    ? repository.slice(prefix.length)
    : repository;
}

function parseRoute(route: ConsoleRoute): RepositoryRoute {
  const requestedPageSize = Number.parseInt(
    route.query.get("page_size") ?? String(defaultPageSize),
    10,
  );
  const requestedSort = route.query.get("sort") ?? defaultSort;
  return {
    page: Math.max(1, Number.parseInt(route.query.get("page") ?? "1", 10) || 1),
    pageSize: [20, 50, 100].includes(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize,
    query: route.query.get("q") ?? "",
    project: route.query.get("project") ?? "",
    sort: validSorts.has(requestedSort) ? requestedSort : defaultSort,
  };
}

function repositoryPath(
  state: RepositoryRoute,
  updates: Partial<RepositoryRoute> = {},
): string {
  const next = { ...state, ...updates };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.query) query.set("q", next.query);
  if (next.pageSize !== defaultPageSize) {
    query.set("page_size", String(next.pageSize));
  }
  if (next.sort !== defaultSort) query.set("sort", next.sort);
  if (next.project) query.set("project", next.project);
  return `repositories${query.size ? `?${query}` : ""}`;
}

async function loadProjectRepositories(
  project: string,
  signal: AbortSignal,
): Promise<RepositoryAsset[]> {
  const items = await loadAllControlItems<RepositorySummary>(
    "repositories",
    { project, sort: "name" },
    signal,
  );
  return items.map((repository) => ({
    ...repository,
    project_name: project,
  }));
}

async function loadRepositories(
  projects: ProjectSummary[],
  signal: AbortSignal,
): Promise<RepositoryData> {
  const repositories: RepositoryAsset[] = [];
  const failures: string[] = [];
  let nextProject = 0;
  const workerCount = Math.min(4, projects.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextProject < projects.length) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const project = projects[nextProject];
      nextProject += 1;
      try {
        repositories.push(
          ...(await loadProjectRepositories(project.name, signal)),
        );
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          throw loadError;
        }
        failures.push(
          `${project.name}: ${loadError instanceof Error ? loadError.message : String(loadError)}`,
        );
      }
    }
  });
  await Promise.all(workers);
  if (!repositories.length && failures.length) throw new Error(failures[0]);
  return { repositories, failures };
}

export function RepositoriesPage({
  route,
  session,
  projects,
  refreshing,
  navigate,
  onRefresh,
  onShowPushCommand,
}: {
  route: ConsoleRoute;
  session: Session;
  projects: ProjectSummary[];
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onShowPushCommand: (project: string, repository?: string) => void;
}) {
  const { locale, t } = useLocale();
  const routeKey = `${route.path}?${route.query.toString()}`;
  const routeState = useMemo(() => parseRoute(route), [routeKey]);
  const [data, setData] = useState<RepositoryData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [query, setQuery] = useState(routeState.query);
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    setQuery(routeState.query);
  }, [routeKey, routeState.query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadRepositories(projects, controller.signal)
      .then(setData)
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projects, reloadToken]);

  const updateRoute = useCallback(
    (updates: Partial<RepositoryRoute>) => {
      navigate(repositoryPath(routeState, updates));
    },
    [navigate, routeState],
  );

  const filtered = useMemo(() => {
    const term = routeState.query.trim().toLocaleLowerCase(locale);
    return (data?.repositories ?? [])
      .filter((repository) => {
        if (
          routeState.project &&
          repository.project_name !== routeState.project
        ) {
          return false;
        }
        return (
          !term ||
          repository.name.toLocaleLowerCase(locale).includes(term) ||
          repository.project_name.toLocaleLowerCase(locale).includes(term)
        );
      })
      .toSorted((left, right) =>
        compareRepositories(left, right, routeState.sort, locale),
      );
  }, [
    data?.repositories,
    locale,
    routeState.project,
    routeState.query,
    routeState.sort,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / routeState.pageSize),
  );
  const page = Math.min(routeState.page, totalPages);
  const visible = filtered.slice(
    (page - 1) * routeState.pageSize,
    page * routeState.pageSize,
  );
  const pagination: ControlPagination = {
    page,
    page_size: routeState.pageSize,
    total: filtered.length,
  };
  const repositories = data?.repositories ?? [];
  const latestUpdate = repositories.reduce<string | undefined>(
    (latest, repository) =>
      repositoryTimestamp(repository.update_time) > repositoryTimestamp(latest)
        ? repository.update_time
        : latest,
    undefined,
  );

  async function refreshPage() {
    await onRefresh();
    setReloadToken((current) => current + 1);
  }

  function submitFilters(value: string) {
    updateRoute({
      page: 1,
      query: value,
    });
  }

  function openRepository(
    event: MouseEvent<HTMLElement>,
    repository: RepositoryAsset,
  ) {
    if ((event.target as HTMLElement).closest("input, button, a")) return;
    navigate(
      `projects/${encodeURIComponent(repository.project_name)}/repositories/${encodeURIComponent(repository.name)}/artifacts`,
    );
  }

  function setViewMode(mode: "card" | "list") {
    const next = { ...preferences, repositoryView: mode };
    setPreferences(next);
    savePreferences(next);
  }

  const projectOptions = [
    { value: "", label: t("全部项目") },
    ...projects.map((project) => ({
      value: project.name,
      label: project.name,
    })),
  ];
  const hasActiveFilters = Boolean(routeState.query || routeState.project);
  const initialLoading = loading && !data;
  const statisticsUnavailable = Boolean(error) && !data;

  return (
    <>
      <PageHeader
        title="镜像仓库"
        subtitle={t("跨项目浏览全部镜像仓库、制品规模与拉取活动")}
        actions={
          <RefreshButton
            refreshing={refreshing || loading}
            onRefresh={() => void refreshPage()}
          />
        }
      />
      {session.demo ? <DemoBanner /> : null}
      {data?.failures.length ? (
        <div className="warning-banner">
          <Icon name="alert" />
          <span>
            <strong>
              {formatNumber(data.failures.length, locale)}{" "}
              {t("个项目读取失败。")}
            </strong>{" "}
            {t("其余项目资产仍可浏览。")}
          </span>
        </div>
      ) : null}
      <section
        className="overview-stats repository-asset-stats"
        aria-label={t("镜像仓库统计")}
        aria-busy={initialLoading}
      >
        <StatCell
          label={t("镜像仓库")}
          value={data ? formatNumber(repositories.length, locale) : "-"}
          foot={
            initialLoading
              ? t("正在载入")
              : statisticsUnavailable
                ? t("统计不可用")
                : `${formatNumber(projects.length, locale)} ${t("个项目")}`
          }
          icon="package"
        />
        <StatCell
          label={t("制品总数")}
          value={
            data
              ? formatNumber(
                  repositories.reduce(
                    (sum, repository) =>
                      sum + numberValue(repository.artifact_count),
                    0,
                  ),
                  locale,
                )
              : "-"
          }
          foot={
            initialLoading
              ? t("正在载入")
              : statisticsUnavailable
                ? t("统计不可用")
                : t("跨项目统计")
          }
          icon="database"
        />
        <StatCell
          label={t("累计拉取")}
          value={
            data
              ? formatNumber(
                  repositories.reduce(
                    (sum, repository) =>
                      sum + numberValue(repository.pull_count),
                    0,
                  ),
                  locale,
                )
              : "-"
          }
          foot={
            initialLoading
              ? t("正在载入")
              : statisticsUnavailable
                ? t("统计不可用")
                : t("Harbor 记录值")
          }
          icon="history"
        />
        <StatCell
          label={t("最近更新")}
          value={data ? formatDate(latestUpdate, locale, false) : "-"}
          foot={
            initialLoading
              ? t("正在载入")
              : statisticsUnavailable
                ? t("统计不可用")
                : t("Harbor 仓库更新时间")
          }
          icon="upload"
        />
      </section>
      <SectionHeading
        title="镜像仓库"
        total={data ? pagination.total : undefined}
        zhUnit="个"
        enUnit="repositories"
        loading={loading && !data}
        error={Boolean(error)}
      />
      <section className="table-shell">
        <form
          className="table-toolbar repository-asset-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            submitFilters(query.trim());
          }}
        >
          <div className="repository-asset-toolbar-primary">
            <div className="toolbar-search">
              <Icon name="search" />
              <input
                name="q"
                type="search"
                maxLength={255}
                value={query}
                placeholder={t("搜索项目或仓库")}
                aria-label={t("搜索项目或仓库")}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
            <label className="toolbar-field">
              <span>{t("项目")}</span>
              <UnifiedSelect
                ariaLabel={t("项目")}
                className="toolbar-select"
                value={routeState.project}
                options={projectOptions}
                onChange={(project) => updateRoute({ page: 1, project })}
              />
            </label>
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
                onClick={() => updateRoute({ page: 1, query: "", project: "" })}
              >
                {t("取消筛选")}
              </button>
            ) : null}
          </div>
          <div className="repository-asset-toolbar-actions">
            <ViewModeToggle
              value={preferences.repositoryView}
              ariaLabel={t("仓库展示方式")}
              listLabel={t("列表视图")}
              cardLabel={t("卡片视图")}
              onChange={setViewMode}
            />
          </div>
        </form>
        <ContentTransition mode={preferences.repositoryView}>
          {loading && !data ? (
            <div className="route-loading" role="status">
              <span className="spinner spinner-small" />
            </div>
          ) : error ? (
            <div className="empty-table" role="alert">
              <strong>{t("镜像仓库载入失败")}</strong>
              <span>{error}</span>
            </div>
          ) : !visible.length ? (
            <EmptyState
              title="没有匹配的镜像仓库"
              description="调整项目或搜索条件后重试。"
              icon="package"
            />
          ) : preferences.repositoryView === "card" ? (
            <div className="repository-card-grid repository-asset-card-grid">
              {visible.map((repository) => (
                <article
                  key={`${repository.project_name}-${String(repository.id ?? repository.name)}`}
                  className="repository-card"
                >
                  <header>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `projects/${encodeURIComponent(repository.project_name)}/repositories/${encodeURIComponent(repository.name)}/artifacts`,
                          )
                        }
                      >
                        {displayRepositoryName(
                          repository.project_name,
                          repository.name,
                        )}
                      </button>
                      <a
                        href={`#/projects/${encodeURIComponent(repository.project_name)}/repositories`}
                      >
                        {repository.project_name}
                      </a>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      title={t("推送指引")}
                      aria-label={t("查看推送指引")}
                      onClick={() =>
                        onShowPushCommand(
                          repository.project_name,
                          repository.name,
                        )
                      }
                    >
                      <Icon name="upload" />
                    </button>
                  </header>
                  <p>
                    {repository.description?.trim()
                      ? repository.description
                      : t("暂无仓库描述")}
                  </p>
                  <dl>
                    <div>
                      <dt>{t("制品")}</dt>
                      <dd>{formatNumber(repository.artifact_count, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("累计拉取")}</dt>
                      <dd>{formatNumber(repository.pull_count, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("最近更新")}</dt>
                      <dd>{formatDate(repository.update_time, locale)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table-stable repository-asset-table">
                <StableTableColumns
                  widths={["28%", "16%", "11%", "11%", "14%", "16%", "44px"]}
                />
                <thead>
                  <tr>
                    <SortableHeader
                      label="仓库"
                      field="name"
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <th>{t("项目")}</th>
                    <SortableHeader
                      label="制品数"
                      field="artifact_count"
                      className="table-cell-number"
                      descendingFirst
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="拉取次数"
                      field="pull_count"
                      className="table-cell-number"
                      descendingFirst
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="创建时间"
                      field="creation_time"
                      className="table-cell-time"
                      descendingFirst
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="最近更新"
                      field="update_time"
                      className="table-cell-time"
                      descendingFirst
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((repository) => (
                    <tr
                      key={`${repository.project_name}-${String(repository.id ?? repository.name)}`}
                      className="clickable-row"
                      onClick={(event) => openRepository(event, repository)}
                    >
                      <td>
                        <div className="cell-title">
                          <span className="cell-stack">
                            <strong>
                              {displayRepositoryName(
                                repository.project_name,
                                repository.name,
                              )}
                            </strong>
                            <small className="mono">
                              #{repository.id ?? "-"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <a
                          href={`#/projects/${encodeURIComponent(repository.project_name)}/repositories`}
                        >
                          {repository.project_name}
                        </a>
                      </td>
                      <td className="mono table-cell-number repository-metric-count">
                        {formatNumber(repository.artifact_count, locale)}
                      </td>
                      <td className="mono table-cell-number repository-metric-count">
                        {formatNumber(repository.pull_count, locale)}
                      </td>
                      <td className="table-cell-time">
                        {formatDate(repository.creation_time, locale)}
                      </td>
                      <td className="table-cell-time">
                        {formatDate(repository.update_time, locale)}
                      </td>
                      <td>
                        <Icon name="chevron" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error ? (
            <Pagination
              pagination={pagination}
              onPageChange={(nextPage) => updateRoute({ page: nextPage })}
              pageSizeOptions={[20, 50, 100]}
              onPageSizeChange={(pageSize) =>
                updateRoute({ page: 1, pageSize })
              }
            />
          ) : null}
        </ContentTransition>
      </section>
    </>
  );
}
