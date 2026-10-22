import { createSortValues } from "../../components/data-table";
import type { ConsoleRoute } from "../../app/hash-router";

export type ReplicationTab = "executions" | "policies";

export type ExecutionFilterValues = {
  policy_id: string;
  status: string;
  trigger: string;
};

export const pageSizeOptions = [20, 50, 100];
const defaultPageSize = 50;

const sortsByTab: Record<ReplicationTab, ReadonlySet<string>> = {
  policies: createSortValues([
    "id",
    "name",
    "direction",
    "remote",
    "trigger",
    "enabled",
    "update_time",
  ]),
  executions: createSortValues([
    "id",
    "policy",
    "trigger",
    "status",
    "tasks",
    "start_time",
    "duration",
  ]),
};

const defaultSorts: Record<ReplicationTab, string> = {
  policies: "id",
  executions: "-start_time",
};

type ReplicationRouteState = {
  tab: ReplicationTab;
  page: number;
  pageSize: number;
  sort: string;
  policyFilter: string;
  executionFilters: ExecutionFilterValues;
};

/** Reads the replication page state from the hash route, ignoring invalid values. */
export function parseReplicationRoute(
  route: ConsoleRoute,
): ReplicationRouteState {
  const tab: ReplicationTab =
    route.query.get("tab") === "executions" ? "executions" : "policies";
  const requestedPage = Number(route.query.get("page"));
  const requestedPageSize = Number(route.query.get("page_size"));
  const requestedSort = route.query.get("sort") ?? defaultSorts[tab];
  return {
    tab,
    page:
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: pageSizeOptions.includes(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize,
    sort: sortsByTab[tab].has(requestedSort)
      ? requestedSort
      : defaultSorts[tab],
    policyFilter: route.query.get("q") ?? "",
    executionFilters: {
      policy_id: route.query.get("policy_id") ?? "",
      status: route.query.get("status") ?? "",
      trigger: route.query.get("trigger") ?? "",
    },
  };
}

/** Sort value for the URL; the default sort is left out to keep links short. */
export function sortQueryValue(tab: ReplicationTab, sort: string): string {
  return sort === defaultSorts[tab] ? "" : sort;
}

export function replicationPath(
  tab: ReplicationTab,
  page = 1,
  pageSize = defaultPageSize,
  values: Record<string, string | number | undefined> = {},
): string {
  const query = new URLSearchParams();
  if (tab !== "policies") query.set("tab", tab);
  if (page > 1) query.set("page", String(page));
  if (pageSize !== defaultPageSize) query.set("page_size", String(pageSize));
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return `replication${query.size ? `?${query}` : ""}`;
}
