import { controlApi, loadAllControlItems } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/console-route";
import type { ControlList, ProjectSummary } from "../../app/models";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { createSortValues } from "../../components/data-table-support";
import { projectKeys } from "./project-keys";

const defaultPageSize = 50;
export const pageSizeOptions = [20, 50, 100];
const defaultSort = "name";
const validSorts = createSortValues([
  "project_id",
  "name",
  "update_time",
  "repo_count",
  "public",
  "auto_scan",
  "prevent_vul",
]);
// Harbor cannot sort projects by these fields, so the console sorts the full
// visible project list itself.
const locallySortedFields = new Set([
  "repo_count",
  "public",
  "auto_scan",
  "prevent_vul",
]);

export type ProjectVisibility = "" | "private" | "public";

export type ProjectRouteState = {
  page: number;
  pageSize: number;
  query: string;
  sort: string;
  visibility: ProjectVisibility;
  owner: string;
};

export function projectNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function metadataEnabled(
  project: ProjectSummary,
  field: "auto_scan" | "prevent_vul" | "public",
): boolean {
  return String(project.metadata?.[field]) === "true";
}

export function parseProjectRoute(route: ConsoleRoute): ProjectRouteState {
  const requestedPageSize = Number.parseInt(
    route.query.get("page_size") ?? String(defaultPageSize),
    10,
  );
  const requestedSort = route.query.get("sort") ?? defaultSort;
  const requestedVisibility = route.query.get("visibility");
  return {
    page: Math.max(1, Number.parseInt(route.query.get("page") ?? "1", 10) || 1),
    pageSize: pageSizeOptions.includes(requestedPageSize)
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

export function projectPath(state: ProjectRouteState): string {
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

function isLocalSort(sort: string): boolean {
  return locallySortedFields.has(sort.replace(/^-/, ""));
}

function filterParameters({
  query,
  owner,
  visibility,
}: Pick<ProjectRouteState, "owner" | "query" | "visibility">) {
  return {
    name: query,
    owner,
    public: (() => {
      if (visibility === "public") {
        return true;
      }
      if (visibility === "private") {
        return false;
      }
      return "";
    })(),
    with_detail: true,
  };
}

function compareProjects({
  left,
  right,
  sort,
  locale,
}: {
  left: ProjectSummary;
  right: ProjectSummary;
  sort: string;
  locale: string;
}): number {
  const descending = sort.startsWith("-");
  const field = sort.replace(/^-/, "");
  const comparison =
    field === "repo_count"
      ? projectNumber(left.repo_count) - projectNumber(right.repo_count)
      : Number(metadataEnabled(left, field as "public")) -
        Number(metadataEnabled(right, field as "public"));
  if (comparison) return descending ? -comparison : comparison;
  return left.name.localeCompare(right.name, locale);
}

type ProjectListData = {
  /** The current table page, or undefined while it loads. */
  table?: ControlList<ProjectSummary>;
  tableLoading: boolean;
  tableError: string;
  /** Every project matching the filters; feeds the overview statistics. */
  visibleProjects?: ProjectSummary[];
  overviewError: string;
  reload: () => void;
};

/**
 * Loads one Harbor page of projects plus the full filtered list for the
 * overview statistics. Sorting by fields Harbor cannot sort reuses the full
 * list instead of asking Harbor for a page.
 */
export function useProjectList(
  route: ProjectRouteState,
  locale: string,
): ProjectListData {
  const localSort = isLocalSort(route.sort);
  const { query, owner, visibility } = route;
  const pageQuery = useLoadedQuery(
    projectKeys.list({ route }),
    (signal) =>
      controlApi.list<ProjectSummary>(
        "projects",
        {
          page: route.page,
          page_size: route.pageSize,
          sort: route.sort,
          ...filterParameters(route),
        },
        signal,
      ),
    { enabled: !localSort },
  );
  // The overview depends only on the filters, not on paging or sorting.
  const overviewQuery = useLoadedQuery(
    projectKeys.list({ overview: { query, owner, visibility } }),
    (signal) =>
      loadAllControlItems<ProjectSummary>(
        "projects",
        {
          sort: defaultSort,
          ...filterParameters({ query, owner, visibility }),
        },
        signal,
      ),
    { keepPrevious: false },
  );
  const page = pageQuery.data;
  const pageLoading = !localSort && pageQuery.loading;
  const tableError = localSort ? "" : pageQuery.error;
  const visibleProjects = overviewQuery.data;
  const overviewError = overviewQuery.error;
  const reload = () => {
    if (!localSort) pageQuery.reload();
    overviewQuery.reload();
  };

  const locallySorted = (() =>
    localSort && visibleProjects
      ? [...visibleProjects].sort((left, right) =>
          compareProjects({
            left: left,
            right: right,
            sort: route.sort,
            locale: locale,
          }),
        )
      : undefined)();

  if (!localSort) {
    return {
      table: page,
      tableLoading: pageLoading,
      tableError,
      visibleProjects,
      overviewError,
      reload,
    };
  }
  const start = (route.page - 1) * route.pageSize;
  return {
    table: locallySorted && {
      items: locallySorted.slice(start, start + route.pageSize),
      pagination: {
        page: route.page,
        page_size: route.pageSize,
        total: locallySorted.length,
      },
    },
    tableLoading: visibleProjects === undefined && !overviewError,
    tableError: "",
    visibleProjects,
    overviewError,
    reload,
  };
}
