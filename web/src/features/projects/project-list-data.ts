import { useCallback, useEffect, useMemo, useState } from "react";

import { controlApi, loadAllControlItems } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/hash-router";
import type { ControlList, ProjectSummary } from "../../app/models";
import { createSortValues } from "../../components/data-table";

export const defaultPageSize = 50;
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
    public:
      visibility === "public" ? true : visibility === "private" ? false : "",
    with_detail: true,
  };
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
      ? projectNumber(left.repo_count) - projectNumber(right.repo_count)
      : Number(metadataEnabled(left, field as "public")) -
        Number(metadataEnabled(right, field as "public"));
  if (comparison) return descending ? -comparison : comparison;
  return left.name.localeCompare(right.name, locale);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export type ProjectListData = {
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
  const [page, setPage] = useState<ControlList<ProjectSummary>>();
  const [pageLoading, setPageLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const [visibleProjects, setVisibleProjects] = useState<ProjectSummary[]>();
  const [overviewError, setOverviewError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(
    () => setReloadToken((current) => current + 1),
    [],
  );
  const localSort = isLocalSort(route.sort);
  const { query, owner, visibility } = route;

  useEffect(() => {
    if (localSort) {
      setPageLoading(false);
      setTableError("");
      return;
    }
    const controller = new AbortController();
    setPageLoading(true);
    setTableError("");
    void controlApi
      .list<ProjectSummary>(
        "projects",
        {
          page: route.page,
          page_size: route.pageSize,
          sort: route.sort,
          ...filterParameters(route),
        },
        controller.signal,
      )
      .then(setPage)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setTableError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPageLoading(false);
      });
    return () => controller.abort();
  }, [localSort, reloadToken, route]);

  // The overview depends only on the filters, not on paging or sorting.
  useEffect(() => {
    const controller = new AbortController();
    setVisibleProjects(undefined);
    setOverviewError("");
    void loadAllControlItems<ProjectSummary>(
      "projects",
      {
        sort: defaultSort,
        ...filterParameters({ query, owner, visibility }),
      },
      controller.signal,
    )
      .then(setVisibleProjects)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setOverviewError(errorText(error));
      });
    return () => controller.abort();
  }, [owner, query, reloadToken, visibility]);

  const locallySorted = useMemo(
    () =>
      localSort && visibleProjects
        ? [...visibleProjects].sort((left, right) =>
            compareProjects(left, right, route.sort, locale),
          )
        : undefined,
    [locale, localSort, route.sort, visibleProjects],
  );

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
