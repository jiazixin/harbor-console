import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { controlApi } from "../../app/api-client";
import { formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { ControlList, ProjectSummary, Session } from "../../app/models";
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";

const defaultPageSize = 50;
const defaultSort = "name";
const validPageSizes = new Set([20, 50, 100]);
const validSorts = new Set([
  "project_id",
  "-project_id",
  "name",
  "-update_time",
  "update_time",
  "-repo_count",
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
      sort: route.sort,
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
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    setFilterName(routeState.query);
    setFilterVisibility(routeState.visibility);
    setFilterOwner(routeState.owner);
    setSelectedIds(new Set());
  }, [routeKey, routeState.owner, routeState.query, routeState.visibility]);

  useEffect(() => {
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
  }, [reloadToken, routeKey, routeState]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntering(false);
      return;
    }
    const timer = window.setTimeout(() => setEntering(false), 380);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedProjects = useMemo(
    () =>
      (data?.items ?? []).filter((project) =>
        selectedIds.has(numberValue(project.project_id)),
      ),
    [data?.items, selectedIds],
  );
  const selectedVisibleCount = selectedProjects.length;
  const allSelected =
    Boolean(data?.items.length) && selectedVisibleCount === data?.items.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;
  const motionClass = entering ? " motion-route-enter" : "";

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

  return (
    <>
      <PageHeader
        title="项目"
        subtitle={t("管理 Harbor 中的项目边界与访问策略")}
        motionClass={motionClass}
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
      {session.demo ? <DemoBanner motionClass={motionClass} /> : null}
      <section className={`table-shell${motionClass}`}>
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
          <div className="toolbar-spacer" />
          <label className="toolbar-field">
            <span>{t("排序")}</span>
            <UnifiedSelect
              className="toolbar-select"
              value={routeState.sort}
              ariaLabel={t("排序")}
              options={[
                { value: "project_id", label: "ID" },
                { value: "-project_id", label: t("ID（倒序）") },
                { value: "name", label: t("名称") },
                { value: "-update_time", label: t("最近更新") },
                { value: "update_time", label: t("最早更新") },
                { value: "-repo_count", label: t("仓库最多") },
              ]}
              onChange={(sort) => updateRoute({ page: 1, sort })}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("每页")}</span>
            <UnifiedSelect
              className="toolbar-select"
              value={String(routeState.pageSize)}
              ariaLabel={t("每页条数")}
              options={[20, 50, 100].map((pageSize) => ({
                value: String(pageSize),
                label: `${String(pageSize)} ${t("条")}`,
              }))}
              onChange={(pageSize) =>
                updateRoute({ page: 1, pageSize: Number(pageSize) })
              }
            />
          </label>
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
        {loading ? (
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
        {!loading && !error && !data?.items.length ? (
          <div className="empty-state">
            <div>
              <span className="state-icon">
                <Icon name="folder" />
              </span>
              <h2>{t("没有项目")}</h2>
              <p>{t("当前筛选条件下没有项目。")}</p>
            </div>
          </div>
        ) : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll">
            <table className="project-select-table">
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
                                data.items.map((project) =>
                                  numberValue(project.project_id),
                                ),
                              )
                            : new Set(),
                        )
                      }
                    />
                  </th>
                  <th>{t("项目")}</th>
                  <th>{t("可见性")}</th>
                  <th>{t("仓库数")}</th>
                  <th>{t("自动扫描")}</th>
                  <th>{t("漏洞阻止")}</th>
                  <th>{t("最近更新")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((project) => {
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
                            toggleProject(project, event.currentTarget.checked)
                          }
                        />
                      </td>
                      <td>
                        <div className="cell-title">
                          <span className="cell-icon">
                            <Icon name="folder" />
                          </span>
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
                      <td>
                        <span
                          className={`badge${publicProject ? " badge-blue" : ""}`}
                        >
                          {t(publicProject ? "公开" : "私有")}
                        </span>
                      </td>
                      <td className="mono project-repository-count">
                        {formatNumber(project.repo_count, locale)}
                      </td>
                      <td>
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
                      <td>
                        <span
                          className={`badge${vulnerabilityBlocking ? " badge-green" : ""}`}
                        >
                          {vulnerabilityBlocking
                            ? `${t(severityLabel(project.metadata?.severity))}${locale === "en-US" ? " and above" : "及以上"}`
                            : t("未启用")}
                        </span>
                      </td>
                      <td>
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
        {!loading && !error && data ? (
          <Pagination
            pagination={data.pagination}
            onPageChange={(page) => updateRoute({ page })}
          />
        ) : null}
      </section>
    </>
  );
}
