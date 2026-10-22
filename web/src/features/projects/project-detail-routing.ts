import type { ConsoleRoute } from "../../app/hash-router";
import type { HarborPermission } from "../../app/models";
import { createSortValues } from "../../components/data-table";
import { type IconName } from "../../components/icons";

const defaultPageSize = 50;
const defaultRepositorySort = "-update_time";
const defaultAuditSort = "-op_time";
const validSections = new Set([
  "repositories",
  "members",
  "robots",
  "webhooks",
  "rules",
  "retention",
  "audit",
  "preheat",
  "settings",
]);
const validRepositorySorts = createSortValues([
  "name",
  "artifact_count",
  "pull_count",
  "update_time",
]);
const validAuditSorts = createSortValues([
  "id",
  "op_time",
  "username",
  "resource_type",
  "operation",
  "operation_result",
]);

type ProjectSection =
  | "audit"
  | "members"
  | "preheat"
  | "repositories"
  | "retention"
  | "robots"
  | "rules"
  | "settings"
  | "webhooks";

export type ProjectDetailRoute = {
  project: string;
  section: ProjectSection;
  page: number;
  pageSize: number;
  query: string;
  sort: string;
};

export const projectTabs: {
  section: ProjectSection;
  label: string;
  icon: IconName;
  resource: string;
  action: string;
}[] = [
  {
    section: "repositories",
    label: "仓库",
    icon: "package",
    resource: "repository",
    action: "list",
  },
  {
    section: "members",
    label: "成员",
    icon: "users",
    resource: "member",
    action: "list",
  },
  {
    section: "robots",
    label: "机器人账号",
    icon: "terminal",
    resource: "robot",
    action: "list",
  },
  {
    section: "webhooks",
    label: "Webhook",
    icon: "refresh",
    resource: "notification-policy",
    action: "list",
  },
  {
    section: "rules",
    label: "项目规则",
    icon: "shield",
    resource: "immutable-tag",
    action: "list",
  },
  {
    section: "retention",
    label: "Tag 保留",
    icon: "history",
    resource: "tag-retention",
    action: "read",
  },
  {
    section: "audit",
    label: "审计",
    icon: "history",
    resource: "audit-log",
    action: "list",
  },
  {
    section: "preheat",
    label: "P2P 预热",
    icon: "play",
    resource: "preheat-policy",
    action: "read",
  },
  {
    section: "settings",
    label: "项目设置",
    icon: "settings",
    resource: "configuration",
    action: "read",
  },
];

export function hasPermission(
  permissions: HarborPermission[],
  resource: string,
  action: string,
): boolean {
  return permissions.some(
    (permission) =>
      (permission.resource === resource || permission.resource === "*") &&
      (permission.action === action || permission.action === "*"),
  );
}

export function isSectionAllowed(
  section: ProjectSection,
  permissions: HarborPermission[],
  isSystemAdmin: boolean,
): boolean {
  if (isSystemAdmin) return true;
  const tab = projectTabs.find((item) => item.section === section);
  return Boolean(tab && hasPermission(permissions, tab.resource, tab.action));
}

export function parseRoute(route: ConsoleRoute): ProjectDetailRoute {
  const requestedSection = route.segments[2] ?? "repositories";
  const section = validSections.has(requestedSection)
    ? (requestedSection as ProjectSection)
    : "repositories";
  const requestedPageSize = Number.parseInt(
    route.query.get("page_size") ?? String(defaultPageSize),
    10,
  );
  const defaultSort =
    section === "audit" ? defaultAuditSort : defaultRepositorySort;
  const requestedSort = route.query.get("sort") ?? defaultSort;
  const validSorts =
    section === "audit" ? validAuditSorts : validRepositorySorts;
  return {
    project: route.segments[1] ?? "",
    section,
    page: Math.max(1, Number.parseInt(route.query.get("page") ?? "1", 10) || 1),
    pageSize: [20, 50, 100].includes(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize,
    query: route.query.get("q") ?? "",
    sort: validSorts.has(requestedSort) ? requestedSort : defaultSort,
  };
}

export function projectSectionPath(
  state: ProjectDetailRoute,
  updates: Partial<ProjectDetailRoute> = {},
): string {
  const nextSection = updates.section ?? state.section;
  const next = {
    ...state,
    ...updates,
    sort:
      updates.sort ??
      (updates.section && updates.section !== state.section
        ? nextSection === "audit"
          ? defaultAuditSort
          : defaultRepositorySort
        : state.sort),
  };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.query) query.set("q", next.query);
  if (next.pageSize !== defaultPageSize) {
    query.set("page_size", String(next.pageSize));
  }
  if (next.section === "repositories") {
    if (next.sort !== defaultRepositorySort) query.set("sort", next.sort);
  }
  if (next.section === "audit") {
    if (next.sort !== defaultAuditSort) query.set("sort", next.sort);
  }
  return `projects/${encodeURIComponent(next.project)}/${next.section}${query.size ? `?${query}` : ""}`;
}
