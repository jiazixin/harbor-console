import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { controlApi } from "../../app/api-client";
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
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";
import { ViewModeToggle } from "../../components/view-mode-toggle";

const defaultPageSize = 50;
const defaultSort = "-artifact_count";
const validSorts = new Set([
  "-artifact_count",
  "-pull_count",
  "-update_time",
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

function timestamp(value: string | undefined): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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
  const items: RepositoryAsset[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const collection = await controlApi.list<RepositorySummary>(
      "repositories",
      { project, page, page_size: 100, sort: "name" },
      signal,
    );
    items.push(
      ...collection.items.map((repository) => ({
        ...repository,
        project_name: project,
      })),
    );
    if (
      items.length >= collection.pagination.total ||
      collection.items.length < 100
    ) {
      break;
    }
  }
  return items;
}

async function loadRepositories(
  projects: ProjectSummary[],
  signal: AbortSignal,
): Promise<RepositoryData> {
  const repositories: RepositoryAsset[] = [];
  const failures: string[] = [];
  for (let offset = 0; offset < projects.length; offset += 4) {
    const batch = projects.slice(offset, offset + 4);
    const settled = await Promise.allSettled(
      batch.map((project) => loadProjectRepositories(project.name, signal)),
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        repositories.push(...result.value);
        return;
      }
      failures.push(
        `${batch[index]?.name ?? "-"}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
    });
  }
  if (!repositories.length && failures.length) throw new Error(failures[0]);
  return { repositories, failures };
}

function compareRepositories(
  left: RepositoryAsset,
  right: RepositoryAsset,
  sort: string,
  locale: string,
): number {
  const descending = sort.startsWith("-");
  let comparison: number;
  if (sort === "-update_time") {
    comparison = timestamp(left.update_time) - timestamp(right.update_time);
  } else if (sort === "-artifact_count") {
    comparison =
      numberValue(left.artifact_count) - numberValue(right.artifact_count);
  } else if (sort === "-pull_count") {
    comparison = numberValue(left.pull_count) - numberValue(right.pull_count);
  } else {
    comparison = left.name.localeCompare(right.name, locale);
  }
  if (comparison) return descending ? -comparison : comparison;
  return left.project_name.localeCompare(right.project_name, locale);
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
      timestamp(repository.update_time) > timestamp(latest)
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

  return (
    <>
      <PageHeader
        title="镜像资产"
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
      {data ? (
        <section
          className="overview-stats repository-asset-stats"
          aria-label={t("镜像资产统计")}
        >
          <StatCell
            label={t("镜像仓库")}
            value={formatNumber(repositories.length, locale)}
            foot={`${formatNumber(projects.length, locale)} ${t("个项目")}`}
            icon="package"
          />
          <StatCell
            label={t("制品总数")}
            value={formatNumber(
              repositories.reduce(
                (sum, repository) =>
                  sum + numberValue(repository.artifact_count),
                0,
              ),
              locale,
            )}
            foot={t("跨项目统计")}
            icon="database"
          />
          <StatCell
            label={t("累计拉取")}
            value={formatNumber(
              repositories.reduce(
                (sum, repository) => sum + numberValue(repository.pull_count),
                0,
              ),
              locale,
            )}
            foot={t("Harbor 记录值")}
            icon="history"
          />
          <StatCell
            label={t("最近推送")}
            value={formatDate(latestUpdate, locale, false)}
            foot={t("仓库更新时间")}
            icon="upload"
          />
        </section>
      ) : null}
      <section className="table-shell">
        <div className="table-toolbar repository-asset-toolbar">
          <ToolbarSearchForm
            name="q"
            placeholder="搜索项目或仓库"
            value={query}
            onChange={setQuery}
            onSubmit={submitFilters}
          />
          <div className="toolbar-spacer" />
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
          <label className="toolbar-field">
            <span>{t("排序")}</span>
            <UnifiedSelect
              ariaLabel={t("排序")}
              className="toolbar-select"
              value={routeState.sort}
              options={[
                { value: "-artifact_count", label: t("制品最多") },
                { value: "-pull_count", label: t("拉取最多") },
                { value: "-update_time", label: t("最近推送") },
                { value: "name", label: t("名称") },
              ]}
              onChange={(sort) => updateRoute({ page: 1, sort })}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("每页")}</span>
            <UnifiedSelect
              ariaLabel={t("每页条数")}
              className="toolbar-select"
              value={String(routeState.pageSize)}
              options={[20, 50, 100].map((pageSize) => ({
                value: String(pageSize),
                label: `${String(pageSize)} ${t("条")}`,
              }))}
              onChange={(pageSize) =>
                updateRoute({ page: 1, pageSize: Number(pageSize) })
              }
            />
          </label>
          <ViewModeToggle
            value={preferences.repositoryView}
            ariaLabel={t("仓库展示方式")}
            listLabel={t("列表视图")}
            cardLabel={t("卡片视图")}
            onChange={setViewMode}
          />
        </div>
        {loading ? (
          <div className="route-loading" role="status">
            <span className="spinner spinner-small" />
          </div>
        ) : error ? (
          <div className="empty-table" role="alert">
            <strong>{t("镜像仓库载入失败")}</strong>
            <span>{error}</span>
          </div>
        ) : !visible.length ? (
          <div className="empty-table">
            <span className="state-icon">
              <Icon name="package" />
            </span>
            <strong>{t("没有匹配的镜像仓库")}</strong>
            <span>{t("调整项目或搜索条件后重试。")}</span>
          </div>
        ) : preferences.repositoryView === "card" ? (
          <div className="repository-card-grid repository-asset-card-grid">
            {visible.map((repository) => (
              <article
                key={`${repository.project_name}-${String(repository.id ?? repository.name)}`}
                className="repository-card"
              >
                <header>
                  <Icon name="package" />
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
                    <dt>{t("最近推送")}</dt>
                    <dd>{formatDate(repository.update_time, locale)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("仓库")}</th>
                  <th>{t("项目")}</th>
                  <th>{t("制品数")}</th>
                  <th>{t("拉取次数")}</th>
                  <th>{t("创建时间")}</th>
                  <th>{t("最近推送")}</th>
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
                        <span className="cell-icon">
                          <Icon name="package" />
                        </span>
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
                    <td className="mono repository-metric-count">
                      {formatNumber(repository.artifact_count, locale)}
                    </td>
                    <td className="mono repository-metric-count">
                      {formatNumber(repository.pull_count, locale)}
                    </td>
                    <td>{formatDate(repository.creation_time, locale)}</td>
                    <td>{formatDate(repository.update_time, locale)}</td>
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
          />
        ) : null}
      </section>
    </>
  );
}
