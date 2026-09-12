import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { controlApi, loadAllControlItems } from "../../app/api-client";
import { formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { ControlList, ProjectSummary, Session } from "../../app/models";
import {
  createSortValues,
  Pagination,
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";

const defaultPageSize = 50;
const defaultSort = "name";
const validPageSizes = new Set([20, 50, 100]);
const validSorts = createSortValues([
  "project_id",
  "name",
  "update_time",
  "repo_count",
  "public",
  "auto_scan",
  "prevent_vul",
]);
const localProjectSortFields = new Set([
  "repo_count",
  "public",
  "auto_scan",
  "prevent_vul",
]);

type ProjectVisibility = "" | "private" | "public";

type ProjectRouteState = {
  page: number;
  pageSize: number;
  query: string;
  sort: string;
  visibility: ProjectVisibility;
  owner: string;
};

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function metadataEnabled(project: ProjectSummary, field: string): boolean {
  const metadata = project.metadata;
  const value =
    field === "public"
      ? metadata?.public
      : field === "auto_scan"
        ? metadata?.auto_scan
        : field === "prevent_vul"
          ? metadata?.prevent_vul
          : undefined;
  return String(value) === "true";
}

function parseProjectRoute(route: ConsoleRoute): ProjectRouteState {
  const page = Math.max(
    1,
    Number.parseInt(route.query.get("page") ?? "1", 10) || 1,
  );
  const requestedPageSize = Number.parseInt(
    route.query.get("page_size") ?? String(defaultPageSize),
    10,
  );
  const requestedSort = route.query.get("sort") ?? defaultSort;
  const requestedVisibility = route.query.get("visibility");
  return {
    page,
    pageSize: validPageSizes.has(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize,
    query: route.query.get("q") ?? "",
    sort: validSorts.has(requestedSort) ? requestedSort : defaultSort,
    visibility:
      requestedVisibility === "public" || requestedVisibility === "private"
        ? requestedVisibility
        : "",
    owner: route.query.get("owner") ?? "",
  };
}

function projectPath(state: ProjectRouteState): string {
  const query = new URLSearchParams();
  if (state.page > 1) query.set("page", String(state.page));
  if (state.query) query.set("q", state.query);
  if (state.pageSize !== defaultPageSize) {
    query.set("page_size", String(state.pageSize));
  }
  if (state.sort !== defaultSort) query.set("sort", state.sort);
  if (state.visibility) query.set("visibility", state.visibility);
  if (state.owner) query.set("owner", state.owner);
  return `projects${query.size ? `?${query}` : ""}`;
}

async function loadProjects(
  route: ProjectRouteState,
  signal: AbortSignal,
): Promise<ControlList<ProjectSummary>> {
  return controlApi.list<ProjectSummary>(
    "projects",
    {
      page: route.page,
      page_size: route.pageSize,
      sort: localProjectSortFields.has(route.sort.replace(/^-/, ""))
        ? defaultSort
        : route.sort,
      name: route.query,
      owner: route.owner,
      public:
        route.visibility === "public"
          ? true
          : route.visibility === "private"
            ? false
            : "",
      with_detail: true,
    },
    signal,
  );
}

function compareProjects(
  left: ProjectSummary,
  right: ProjectSummary,
  sort: string,
  locale: string,
): number {
  const descending = sort.startsWith("-");
  const field = sort.replace(/^-/, "");
  const comparison =
    field === "repo_count"
      ? numberValue(left.repo_count) - numberValue(right.repo_count)
      : Number(metadataEnabled(left, field)) -
        Number(metadataEnabled(right, field));
  if (comparison) return descending ? -comparison : comparison;
  return left.name.localeCompare(right.name, locale);
}

async function loadVisibleProjects(
  route: ProjectRouteState,
  signal: AbortSignal,
): Promise<ProjectSummary[]> {
  return loadAllControlItems<ProjectSummary>(
    "projects",
    {
      sort: "name",
      name: route.query,
      owner: route.owner,
      public:
        route.visibility === "public"
          ? true
          : route.visibility === "private"
            ? false
            : "",
      with_detail: true,
    },
    signal,
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

function severityLabel(value: string | undefined): string {
  return (
    {
      critical: "严重",
      high: "高危",
      medium: "中危",
      low: "低危",
      negligible: "可忽略",
      none: "无风险",
      unknown: "未扫描",
    }[value?.toLowerCase() ?? "unknown"] ??
    value ??
    "未扫描"
  );
}

export function ProjectsPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onCreateProject,
  onDeleteProjects,
  onExportProjectCve,
}: {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onCreateProject: () => void;
  onDeleteProjects: (projects: ProjectSummary[]) => void;
  onExportProjectCve: (project: ProjectSummary) => void;
}) {
  const { locale, t } = useLocale();
  const routeKey = route.query.toString();
  const routeState = useMemo(
    () => parseProjectRoute(route),
    [route.path, routeKey],
  );
  const [data, setData] = useState<ControlList<ProjectSummary>>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterName, setFilterName] = useState(routeState.query);
  const [filterVisibility, setFilterVisibility] = useState<ProjectVisibility>(
    routeState.visibility,
  );
  const [filterOwner, setFilterOwner] = useState(routeState.owner);
  const [overviewProjects, setOverviewProjects] = useState<ProjectSummary[]>();
  const [overviewError, setOverviewError] = useState("");
  const overviewRoute = useMemo(
    () => ({
      page: 1,
      pageSize: defaultPageSize,
      query: routeState.query,
      sort: defaultSort,
      visibility: routeState.visibility,
      owner: routeState.owner,
    }),
    [routeState.owner, routeState.query, routeState.visibility],
  );
  const localSort = localProjectSortFields.has(
    routeState.sort.replace(/^-/, ""),
  );

  useEffect(() => {
    setFilterName(routeState.query);
    setFilterVisibility(routeState.visibility);
    setFilterOwner(routeState.owner);
    setSelectedIds(new Set());
  }, [routeKey, routeState.owner, routeState.query, routeState.visibility]);

  useEffect(() => {
    if (localSort) {
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadProjects(routeState, controller.signal)
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
  }, [localSort, reloadToken, routeKey, routeState]);

  useEffect(() => {
    const controller = new AbortController();
    setOverviewProjects(undefined);
    setOverviewError("");
    void loadVisibleProjects(overviewRoute, controller.signal)
      .then(setOverviewProjects)
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setOverviewError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      });
    return () => controller.abort();
  }, [overviewRoute, reloadToken]);

  const locallySortedProjects = useMemo(
    () =>
      localSort
        ? [...(overviewProjects ?? [])].sort((left, right) =>
            compareProjects(left, right, routeState.sort, locale),
          )
        : [],
    [locale, localSort, overviewProjects, routeState.sort],
  );
  const tableData = localSort
    ? overviewProjects
      ? {
          items: locallySortedProjects.slice(
            (routeState.page - 1) * routeState.pageSize,
            routeState.page * routeState.pageSize,
          ),
          pagination: {
            page: routeState.page,
            page_size: routeState.pageSize,
            total: locallySortedProjects.length,
          },
        }
      : undefined
    : data;
  const tableLoading = localSort
    ? overviewProjects === undefined && !overviewError
    : loading;

  const selectedProjects = useMemo(
    () =>
      (tableData?.items ?? []).filter((project) =>
        selectedIds.has(numberValue(project.project_id)),
      ),
    [selectedIds, tableData?.items],
  );
  const selectedVisibleCount = selectedProjects.length;
  const allSelected =
    Boolean(tableData?.items.length) &&
    selectedVisibleCount === tableData?.items.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;
  const hasActiveFilters = Boolean(
    routeState.query || routeState.visibility || routeState.owner,
  );

  const updateRoute = useCallback(
    (updates: Partial<ProjectRouteState>) => {
      navigate(projectPath({ ...routeState, ...updates }));
    },
    [navigate, routeState],
  );

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateRoute({
      page: 1,
      query: filterName.trim(),
      visibility: filterVisibility,
      owner: filterOwner.trim(),
    });
  }

  function toggleProject(project: ProjectSummary, checked: boolean) {
    const id = numberValue(project.project_id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openProject(
    event: MouseEvent<HTMLTableRowElement>,
    project: string,
  ) {
    if ((event.target as HTMLElement).closest("input, button, a")) return;
    navigate(`projects/${encodeURIComponent(project)}`);
  }

  async function refreshPage() {
    await onRefresh();
    setReloadToken((current) => current + 1);
  }

  const visibleProjects = overviewProjects ?? [];
  const autoScanEnabled = visibleProjects.filter((project) =>
    metadataEnabled(project, "auto_scan"),
  ).length;
  const vulnerabilityBlockingEnabled = visibleProjects.filter((project) =>
    metadataEnabled(project, "prevent_vul"),
  ).length;
  const coverage = (enabled: number) =>
    visibleProjects.length
      ? Math.round((enabled / visibleProjects.length) * 100)
      : 0;
  const overviewLoading = overviewProjects === undefined && !overviewError;

  return (
    <>
      <PageHeader
        title="项目中心"
        subtitle={t("管理 Harbor 中的项目边界与访问策略")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => void refreshPage()}
            />
            <button
              className="button button-small button-primary"
              type="button"
              onClick={onCreateProject}
            >
              <Icon name="plus" />
              <span>{t("新建项目")}</span>
            </button>
          </>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      <section
        className="overview-stats project-overview-stats"
        aria-label={t("项目中心概览")}
        aria-busy={overviewLoading}
      >
        <StatCell
          label={t("项目总数")}
          value={
            overviewProjects
              ? formatNumber(overviewProjects.length, locale)
              : "-"
          }
          foot={
            overviewLoading
              ? t("正在载入")
              : overviewError
                ? t("统计不可用")
                : t("当前账号可见项目")
          }
          icon="folder"
        />
        <StatCell
          label={t("仓库数量")}
          value={
            overviewProjects
              ? formatNumber(
                  visibleProjects.reduce(
                    (total, project) => total + numberValue(project.repo_count),
                    0,
                  ),
                  locale,
                )
              : "-"
          }
          foot={
            overviewLoading
              ? t("正在载入")
              : overviewError
                ? t("统计不可用")
                : t("当前筛选结果")
          }
          icon="package"
        />
        <StatCell
          label={t("自动扫描覆盖")}
          value={
            overviewProjects ? `${String(coverage(autoScanEnabled))}%` : "-"
          }
          foot={
            overviewLoading
              ? t("正在载入")
              : overviewError
                ? t("统计不可用")
                : `${t("已启用")} ${formatNumber(autoScanEnabled, locale)} ${t("个")}`
          }
          icon="scan"
        />
        <StatCell
          label={t("漏洞阻止覆盖")}
          value={
            overviewProjects
              ? `${String(coverage(vulnerabilityBlockingEnabled))}%`
              : "-"
          }
          foot={
            overviewLoading
              ? t("正在载入")
              : overviewError
                ? t("统计不可用")
                : `${t("已启用")} ${formatNumber(vulnerabilityBlockingEnabled, locale)} ${t("个")}`
          }
          icon="bug"
        />
      </section>
      {overviewError ? (
        <div className="warning-banner" role="status">
          <Icon name="alert" />
          <span>
            {t("项目概览统计载入失败")}：{overviewError}
          </span>
        </div>
      ) : null}
      <section className="table-shell">
        <form
          className="table-toolbar project-filter-toolbar"
          onSubmit={submitFilters}
        >
          <div className="toolbar-search">
            <Icon name="search" />
            <input
              name="name"
              type="search"
              maxLength={255}
              value={filterName}
              placeholder={t("按项目名称搜索")}
              aria-label={t("按项目名称搜索")}
              onChange={(event) => setFilterName(event.currentTarget.value)}
            />
          </div>
          <div className="toolbar-search project-owner-search">
            <Icon name="users" />
            <input
              name="owner"
              type="search"
              maxLength={255}
              value={filterOwner}
              placeholder={t("项目所有者")}
              aria-label={t("按项目所有者筛选")}
              onChange={(event) => setFilterOwner(event.currentTarget.value)}
            />
          </div>
          <label className="toolbar-field">
            <span>{t("可见性")}</span>
            <UnifiedSelect
              name="visibility"
              className="toolbar-select"
              value={filterVisibility}
              ariaLabel={t("可见性")}
              options={[
                { value: "", label: t("全部项目") },
                { value: "public", label: t("公开") },
                { value: "private", label: t("私有") },
              ]}
              onChange={setFilterVisibility}
            />
          </label>
          <button className="button button-small button-primary" type="submit">
            <Icon name="search" />
            <span>{t("筛选")}</span>
          </button>
          {hasActiveFilters ? (
            <button
              className="button button-small"
              type="button"
              onClick={() =>
                updateRoute({
                  page: 1,
                  query: "",
                  visibility: "",
                  owner: "",
                })
              }
            >
              {t("取消筛选")}
            </button>
          ) : null}
        </form>
        <div className="artifact-batch-toolbar project-batch-toolbar">
          <span>
            <strong>{formatNumber(selectedProjects.length, locale)}</strong>{" "}
            {t("个已选择")}
          </span>
          <div>
            <button
              className="button button-small"
              type="button"
              disabled={selectedProjects.length !== 1}
              onClick={() =>
                selectedProjects[0] && onExportProjectCve(selectedProjects[0])
              }
            >
              <Icon name="download" />
              <span>{t("导出 CVE")}</span>
            </button>
            <button
              className="button button-small button-danger"
              type="button"
              disabled={!selectedProjects.length}
              onClick={() => onDeleteProjects(selectedProjects)}
            >
              <Icon name="trash" />
              <span>{t("删除项目")}</span>
            </button>
          </div>
        </div>
        <div aria-busy={tableLoading}>
          {tableLoading && !tableData ? (
            <div
              className="route-loading"
              role="status"
              aria-label={t("正在载入")}
            >
              <span className="spinner spinner-small" aria-hidden="true" />
            </div>
          ) : null}
          {error ? (
            <div className="error-state" role="alert">
              <div>
                <span className="state-icon">
                  <Icon name="alert" />
                </span>
                <h2>{t("项目载入失败")}</h2>
                <p>{error}</p>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => setReloadToken((current) => current + 1)}
                >
                  <Icon name="refresh" />
                  <span>{t("重试")}</span>
                </button>
              </div>
            </div>
          ) : null}
          {!error && tableData && !tableData.items.length ? (
            <EmptyState
              title="没有项目"
              description="当前筛选条件下没有项目。"
              icon="folder"
            />
          ) : null}
          {!error && tableData?.items.length ? (
            <div className="table-scroll">
              <table className="project-select-table data-table-stable">
                <StableTableColumns
                  widths={[
                    "44px",
                    "28%",
                    "120px",
                    "88px",
                    "176px",
                    "220px",
                    "144px",
                    "44px",
                  ]}
                />
                <thead>
                  <tr>
                    <th className="selection-cell">
                      <SelectAllCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        label={t("选择当前页全部项目")}
                        onChange={(checked) =>
                          setSelectedIds(
                            checked
                              ? new Set(
                                  tableData.items.map((project) =>
                                    numberValue(project.project_id),
                                  ),
                                )
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <SortableHeader
                      label="项目"
                      field="name"
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="可见性"
                      field="public"
                      className="table-cell-center"
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="仓库数"
                      field="repo_count"
                      className="table-cell-number project-repository-count"
                      descendingFirst
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="自动扫描"
                      field="auto_scan"
                      className="table-cell-center"
                      descendingFirst
                      currentSort={routeState.sort}
                      onSort={(sort) => updateRoute({ page: 1, sort })}
                    />
                    <SortableHeader
                      label="漏洞阻止"
                      field="prevent_vul"
                      className="table-cell-center"
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
                  {tableData.items.map((project) => {
                    const id = numberValue(project.project_id);
                    const selected = selectedIds.has(id);
                    const publicProject = metadataEnabled(project, "public");
                    const vulnerabilityBlocking = metadataEnabled(
                      project,
                      "prevent_vul",
                    );
                    return (
                      <tr
                        key={id || project.name}
                        className={`clickable-row${selected ? " selected-row" : ""}`}
                        onClick={(event) => openProject(event, project.name)}
                      >
                        <td className="selection-cell">
                          <input
                            type="checkbox"
                            checked={selected}
                            aria-label={`${t("选择")} ${project.name}`}
                            onChange={(event) =>
                              toggleProject(
                                project,
                                event.currentTarget.checked,
                              )
                            }
                          />
                        </td>
                        <td className="table-cell-center">
                          <div className="cell-title">
                            <span className="cell-stack">
                              <OverflowText as="strong">
                                {project.name}
                              </OverflowText>
                              <small>
                                {project.owner_name ?? "-"} · #
                                {project.project_id ?? "-"}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td className="table-cell-center">
                          <span
                            className={`badge${publicProject ? " badge-blue" : ""}`}
                          >
                            {t(publicProject ? "公开" : "私有")}
                          </span>
                        </td>
                        <td className="mono table-cell-number project-repository-count">
                          {formatNumber(project.repo_count, locale)}
                        </td>
                        <td className="table-cell-center">
                          <span
                            className={`badge${metadataEnabled(project, "auto_scan") ? " badge-green" : ""}`}
                          >
                            {t(
                              metadataEnabled(project, "auto_scan")
                                ? "已启用"
                                : "未启用",
                            )}
                          </span>
                        </td>
                        <td className="table-cell-center">
                          <span
                            className={`badge${vulnerabilityBlocking ? " badge-green" : ""}`}
                          >
                            {vulnerabilityBlocking
                              ? `${t(severityLabel(project.metadata?.severity))}${locale === "en-US" ? " and above" : "及以上"}`
                              : t("未启用")}
                          </span>
                        </td>
                        <td className="table-cell-time">
                          {formatDate(
                            project.update_time ?? project.creation_time,
                            locale,
                          )}
                        </td>
                        <td>
                          <Icon name="chevron" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {!error && tableData ? (
            <Pagination
              pagination={tableData.pagination}
              onPageChange={(page) => updateRoute({ page })}
              pageSizeOptions={[20, 50, 100]}
              onPageSizeChange={(pageSize) =>
                updateRoute({ page: 1, pageSize })
              }
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
