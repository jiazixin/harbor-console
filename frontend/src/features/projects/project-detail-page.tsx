import { ContentTransition } from "../../components/content-transition";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiError, controlApi } from "../../app/api-client";
import { formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  AuditLog,
  ControlPagination,
  HarborPermission,
  ImmutableTagRule,
  PermissionMetadata,
  PreheatPolicy,
  PreheatProvider,
  ProjectDetailSummary,
  ProjectLabel,
  ProjectMember,
  ProjectQuota,
  ProjectRobot,
  ProjectScanner,
  ProjectSummary,
  ProjectWebhook,
  Registry,
  RepositorySummary,
  RetentionExecution,
  RetentionMetadata,
  RetentionPolicy,
  Session,
  WebhookEventMetadata,
} from "../../app/models";
import { loadPreferences, savePreferences } from "../../app/preferences";
import {
  createSortValues,
  Pagination,
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import { Icon, type IconName } from "../../components/icons";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import {
  Breadcrumb,
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { ViewModeToggle } from "../../components/view-mode-toggle";
import { useCenterActiveTab } from "../../components/use-center-active-tab";
import {
  ProjectAuditSection,
  type ProjectAuditError,
} from "./project-audit-section";
import { ProjectMembersSection } from "./project-members-section";
import {
  ProjectPreheatSection,
  type ProjectPreheatAction,
} from "./project-preheat-section";
import {
  ProjectRetentionSection,
  type ProjectRetentionAction,
} from "./project-retention-section";
import { ProjectRulesSection } from "./project-rules-section";
import { ProjectRobotsSection } from "./project-robots-section";
import {
  ProjectSettingsSection,
  type ProjectSettingsData,
} from "./project-settings-section";
import { ProjectWebhooksSection } from "./project-webhooks-section";
import { sortRepositories } from "../repositories/repository-sorting";

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

type ProjectDetailRoute = {
  project: string;
  section: ProjectSection;
  page: number;
  pageSize: number;
  query: string;
  sort: string;
};

type ProjectPageData = {
  project: ProjectSummary;
  summary: ProjectDetailSummary;
  repositories: RepositorySummary[];
  members: ProjectMember[];
  robots: ProjectRobot[];
  webhooks: ProjectWebhook[];
  immutableRules: ImmutableTagRule[];
  projectLabels: ProjectLabel[];
  retentionMetadata: RetentionMetadata;
  retentionPolicy?: RetentionPolicy;
  retentionExecutions: RetentionExecution[];
  retentionPagination: ControlPagination;
  auditLogs: AuditLog[];
  auditPagination: ControlPagination;
  auditError?: ProjectAuditError;
  preheatPolicies: PreheatPolicy[];
  preheatProviders: PreheatProvider[];
  preheatPagination: ControlPagination;
  preheatErrors: string[];
  settings: ProjectSettingsData;
  pagination: ControlPagination;
  permissionMetadata?: PermissionMetadata;
  webhookEventMetadata: WebhookEventMetadata;
  permissions: HarborPermission[];
  permissionDenied: boolean;
};

const projectTabs: {
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

function hasPermission(
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

function isSectionAllowed(
  section: ProjectSection,
  permissions: HarborPermission[],
  isSystemAdmin: boolean,
): boolean {
  if (isSystemAdmin) return true;
  const tab = projectTabs.find((item) => item.section === section);
  return Boolean(tab && hasPermission(permissions, tab.resource, tab.action));
}

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function rejectionMessage(result: PromiseSettledResult<unknown>): string {
  if (result.status === "fulfilled") return "";
  return result.reason instanceof Error
    ? result.reason.message
    : String(result.reason);
}

function auditQueryValue(value: string): string {
  const normalized = value.trim().slice(0, 200);
  if (/^[-A-Za-z0-9_.@:/+]+$/.test(normalized)) return normalized;
  return `"${normalized.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function parseRoute(route: ConsoleRoute): ProjectDetailRoute {
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

function projectSectionPath(
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

async function listAllRepositories(
  project: string,
  signal: AbortSignal,
): Promise<RepositorySummary[]> {
  const pageSize = 100;
  const parameters = {
    project,
    page: 1,
    page_size: pageSize,
    sort: "name",
  };
  const first = await controlApi.list<RepositorySummary>(
    "repositories",
    parameters,
    signal,
  );
  const pageCount = Math.ceil(first.pagination.total / pageSize);
  if (pageCount <= 1) return first.items;
  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      controlApi.list<RepositorySummary>(
        "repositories",
        { ...parameters, page: index + 2 },
        signal,
      ),
    ),
  );
  return first.items.concat(...remaining.map((page) => page.items));
}

async function loadProjectPage(
  route: ProjectDetailRoute,
  signal: AbortSignal,
  isSystemAdmin: boolean,
  locale: string,
): Promise<ProjectPageData> {
  const projectRequest = controlApi.data<ProjectSummary>(
    "project",
    { project: route.project },
    signal,
  );
  const summaryRequest = controlApi
    .data<ProjectDetailSummary>(
      "project-summary",
      { project: route.project },
      signal,
    )
    .catch(() => undefined);
  const allRequest = listAllRepositories(route.project, signal);
  const project = await projectRequest;
  if (!project) throw new Error("项目不存在");
  const permissions = isSystemAdmin
    ? []
    : (
        await controlApi.list<HarborPermission>(
          "current-permissions",
          {
            scope: `/project/${String(project.project_id ?? "")}`,
            relative: true,
          },
          signal,
        )
      ).items;
  const permissionDenied = !isSectionAllowed(
    route.section,
    permissions,
    isSystemAdmin,
  );
  const retentionId = Number.parseInt(project.metadata?.retention_id ?? "", 10);
  const repositoryRequest =
    !permissionDenied && route.section === "repositories"
      ? allRequest.then((repositories) => {
          const query = route.query.trim().toLocaleLowerCase(locale);
          const sorted = sortRepositories(
            repositories.filter(
              (repository) =>
                !query ||
                repository.name.toLocaleLowerCase(locale).includes(query),
            ),
            route.sort,
            locale,
          );
          return {
            items: sorted.slice(
              (route.page - 1) * route.pageSize,
              route.page * route.pageSize,
            ),
            pagination: {
              page: route.page,
              page_size: route.pageSize,
              total: sorted.length,
            },
          };
        })
      : Promise.resolve(undefined);
  const memberRequest =
    !permissionDenied && route.section === "members"
      ? controlApi.list<ProjectMember>(
          "project-members",
          {
            project: route.project,
            page: route.page,
            page_size: route.pageSize,
            entityname: route.query,
          },
          signal,
        )
      : Promise.resolve(undefined);
  const robotRequest =
    !permissionDenied && route.section === "robots"
      ? controlApi.list<ProjectRobot>(
          "robots",
          {
            page: route.page,
            page_size: route.pageSize,
            sort: "name",
            q: `Level=project,ProjectID=${String(project.project_id ?? "")}`,
          },
          signal,
        )
      : Promise.resolve(undefined);
  const permissionMetadataRequest =
    !permissionDenied && route.section === "robots"
      ? controlApi.data<PermissionMetadata>("permissions", {}, signal)
      : Promise.resolve(undefined);
  const webhookRequest =
    !permissionDenied && route.section === "webhooks"
      ? controlApi.list<ProjectWebhook>(
          "webhooks",
          {
            project: route.project,
            page: route.page,
            page_size: route.pageSize,
            sort: "name",
          },
          signal,
        )
      : Promise.resolve(undefined);
  const webhookEventMetadataRequest =
    !permissionDenied && route.section === "webhooks"
      ? controlApi.data<WebhookEventMetadata>(
          "webhook-events",
          { project: route.project },
          signal,
        )
      : Promise.resolve(undefined);
  const immutableRuleRequest =
    !permissionDenied && route.section === "rules"
      ? controlApi.list<ImmutableTagRule>(
          "immutable-rules",
          {
            project: route.project,
            page: 1,
            page_size: 100,
            sort: "priority",
          },
          signal,
        )
      : Promise.resolve(undefined);
  const projectLabelRequest =
    !permissionDenied && route.section === "rules"
      ? controlApi.list<ProjectLabel>(
          "labels",
          {
            scope: "p",
            project_id: project.project_id,
            page: 1,
            page_size: 100,
            sort: "name",
          },
          signal,
        )
      : Promise.resolve(undefined);
  const retentionMetadataRequest =
    !permissionDenied && ["retention", "rules"].includes(route.section)
      ? controlApi
          .data<RetentionMetadata>("retention-metadatas", {}, signal)
          .catch((metadataError: unknown) => {
            if (
              metadataError instanceof DOMException &&
              metadataError.name === "AbortError"
            ) {
              throw metadataError;
            }
            return {
              load_error:
                metadataError instanceof Error
                  ? metadataError.message
                  : String(metadataError),
            };
          })
      : Promise.resolve(undefined);
  const retentionPolicyRequest =
    !permissionDenied &&
    route.section === "retention" &&
    Number.isFinite(retentionId) &&
    retentionId > 0
      ? controlApi.data<RetentionPolicy>(
          "retention",
          { id: retentionId },
          signal,
        )
      : Promise.resolve(undefined);
  const retentionExecutionRequest =
    !permissionDenied &&
    route.section === "retention" &&
    Number.isFinite(retentionId) &&
    retentionId > 0
      ? controlApi.list<RetentionExecution>(
          "retention-executions",
          { id: retentionId, page: route.page, page_size: 20 },
          signal,
        )
      : Promise.resolve(undefined);
  const auditRequest =
    !permissionDenied && route.section === "audit"
      ? controlApi
          .list<AuditLog>(
            "project-audit-logs",
            {
              project: route.project,
              page: route.page,
              page_size: route.pageSize,
              sort: route.sort,
              q: route.query ? `resource=~${auditQueryValue(route.query)}` : "",
            },
            signal,
          )
          .then((collection) => ({ collection }))
          .catch((auditError: unknown) => {
            if (
              auditError instanceof DOMException &&
              auditError.name === "AbortError"
            ) {
              throw auditError;
            }
            return {
              error: {
                message:
                  auditError instanceof Error
                    ? auditError.message
                    : String(auditError),
                status:
                  auditError instanceof ApiError
                    ? auditError.status
                    : undefined,
              },
            };
          })
      : Promise.resolve(undefined);
  const preheatPolicyRequest =
    !permissionDenied && route.section === "preheat"
      ? controlApi
          .list<PreheatPolicy>(
            "preheat-policies",
            {
              project: route.project,
              page: route.page,
              page_size: route.pageSize,
              sort: "-update_time",
              q: route.query ? `name=~${route.query}` : "",
            },
            signal,
          )
          .then((collection) => ({ collection }))
          .catch((preheatError: unknown) => {
            if (
              preheatError instanceof DOMException &&
              preheatError.name === "AbortError"
            ) {
              throw preheatError;
            }
            return {
              error:
                preheatError instanceof Error
                  ? preheatError.message
                  : String(preheatError),
            };
          })
      : Promise.resolve(undefined);
  const preheatProviderRequest =
    !permissionDenied && route.section === "preheat"
      ? controlApi
          .data<PreheatProvider[]>(
            "project-preheat-providers",
            { project: route.project },
            signal,
          )
          .then((providers) => ({ providers: providers ?? [] }))
          .catch((preheatError: unknown) => {
            if (
              preheatError instanceof DOMException &&
              preheatError.name === "AbortError"
            ) {
              throw preheatError;
            }
            return {
              error:
                preheatError instanceof Error
                  ? preheatError.message
                  : String(preheatError),
            };
          })
      : Promise.resolve(undefined);
  const settingsRequest =
    !permissionDenied && route.section === "settings"
      ? Promise.allSettled([
          controlApi.data<ProjectScanner>(
            "project-scanner",
            { project: route.project },
            signal,
          ),
          controlApi.list<ProjectScanner>(
            "project-scanner-candidates",
            {
              project: route.project,
              page: 1,
              page_size: 100,
              sort: "name",
            },
            signal,
          ),
          numberValue(project.registry_id) > 0
            ? controlApi.data<Registry>(
                "registry",
                { id: project.registry_id },
                signal,
              )
            : Promise.resolve(undefined),
          controlApi.list<ProjectQuota>(
            "quotas",
            {
              page: 1,
              page_size: 1,
              reference: "project",
              reference_id: project.project_id,
            },
            signal,
          ),
        ]).then(
          ([
            scanner,
            candidates,
            proxyRegistry,
            quota,
          ]): ProjectSettingsData => {
            const quotaItems =
              quota.status === "fulfilled" ? quota.value.items : [];
            return {
              scanner:
                scanner.status === "fulfilled" ? scanner.value : undefined,
              candidates:
                candidates.status === "fulfilled" ? candidates.value.items : [],
              proxyRegistry:
                proxyRegistry.status === "fulfilled"
                  ? proxyRegistry.value
                  : undefined,
              quota: quotaItems.find(
                (item) =>
                  numberValue(item.ref?.id) === numberValue(project.project_id),
              ),
              scannerError: rejectionMessage(scanner),
              candidatesError: rejectionMessage(candidates),
              proxyRegistryError: rejectionMessage(proxyRegistry),
              quotaError: rejectionMessage(quota),
            };
          },
        )
      : Promise.resolve<ProjectSettingsData>({ candidates: [] });
  const [
    summary,
    repositoryCollection,
    memberCollection,
    robotCollection,
    permissionMetadata,
    webhookCollection,
    webhookEventMetadata,
    immutableRuleCollection,
    projectLabelCollection,
    retentionMetadata,
    retentionPolicy,
    retentionExecutionCollection,
    auditResult,
    preheatPolicyResult,
    preheatProviderResult,
    settings,
    allRepositories,
  ] = await Promise.all([
    summaryRequest,
    repositoryRequest,
    memberRequest,
    robotRequest,
    permissionMetadataRequest,
    webhookRequest,
    webhookEventMetadataRequest,
    immutableRuleRequest,
    projectLabelRequest,
    retentionMetadataRequest,
    retentionPolicyRequest,
    retentionExecutionRequest,
    auditRequest,
    preheatPolicyRequest,
    preheatProviderRequest,
    settingsRequest,
    allRequest,
  ]);
  const pagination = repositoryCollection?.pagination ??
    memberCollection?.pagination ??
    robotCollection?.pagination ??
    webhookCollection?.pagination ?? {
      page: 1,
      page_size: route.pageSize,
      total: 0,
    };
  const auditCollection =
    auditResult && "collection" in auditResult
      ? auditResult.collection
      : undefined;
  const auditError =
    auditResult && "error" in auditResult ? auditResult.error : undefined;
  const preheatCollection =
    preheatPolicyResult && "collection" in preheatPolicyResult
      ? preheatPolicyResult.collection
      : undefined;
  const preheatProviders =
    preheatProviderResult && "providers" in preheatProviderResult
      ? preheatProviderResult.providers
      : [];
  const preheatErrors = [preheatPolicyResult, preheatProviderResult].flatMap(
    (result) => (result && "error" in result ? [result.error] : []),
  );
  return {
    project,
    summary: {
      ...summary,
      repo_count: allRepositories.length,
      artifact_count: allRepositories.reduce(
        (sum, repository) => sum + numberValue(repository.artifact_count),
        0,
      ),
    },
    repositories: repositoryCollection?.items ?? [],
    members: memberCollection?.items ?? [],
    robots: robotCollection?.items ?? [],
    webhooks: webhookCollection?.items ?? [],
    immutableRules: immutableRuleCollection?.items ?? [],
    projectLabels: projectLabelCollection?.items ?? [],
    retentionMetadata: retentionMetadata ?? {},
    retentionPolicy,
    retentionExecutions: retentionExecutionCollection?.items ?? [],
    retentionPagination: retentionExecutionCollection?.pagination ?? {
      page: 1,
      page_size: 20,
      total: 0,
    },
    auditLogs: auditCollection?.items ?? [],
    auditPagination: auditCollection?.pagination ?? {
      page: 1,
      page_size: route.pageSize,
      total: 0,
    },
    auditError,
    preheatPolicies: preheatCollection?.items ?? [],
    preheatProviders,
    preheatPagination: preheatCollection?.pagination ?? {
      page: 1,
      page_size: route.pageSize,
      total: 0,
    },
    preheatErrors,
    settings,
    pagination,
    permissionMetadata,
    webhookEventMetadata: webhookEventMetadata ?? {},
    permissions,
    permissionDenied,
  };
}

function displayRepositoryName(project: string, repository: string): string {
  const prefix = `${project}/`;
  return repository.startsWith(prefix)
    ? repository.slice(prefix.length)
    : repository;
}

function descriptionOr(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value;
}

export function ProjectDetailPage({
  route,
  session,
  isSystemAdmin,
  refreshing,
  navigate,
  onRefresh,
  onDeleteRepositories,
  onShowPushCommand,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onCreateRobot,
  onEditRobot,
  onResetRobotSecret,
  onDeleteRobot,
  onCreateWebhook,
  onEditWebhook,
  onShowWebhookHistory,
  onDeleteWebhook,
  onCreateImmutableRule,
  onEditImmutableRule,
  onDeleteImmutableRule,
  onCreateProjectLabel,
  onEditProjectLabel,
  onDeleteProjectLabel,
  onRetentionAction,
  onPreheatAction = () => undefined,
  onDeleteProject = () => undefined,
  onNotice = () => undefined,
}: {
  route: ConsoleRoute;
  session: Session;
  isSystemAdmin: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onDeleteRepositories: (
    project: string,
    repositories: RepositorySummary[],
  ) => void;
  onShowPushCommand: (project: string, repository?: string) => void;
  onAddMember: (project: string, members: ProjectMember[]) => void;
  onEditMember: (project: string, member: ProjectMember) => void;
  onDeleteMember: (project: string, member: ProjectMember) => void;
  onCreateRobot: (project: string, permissions: HarborPermission[]) => void;
  onEditRobot: (
    project: string,
    robot: ProjectRobot,
    permissions: HarborPermission[],
  ) => void;
  onResetRobotSecret: (project: string, robot: ProjectRobot) => void;
  onDeleteRobot: (project: string, robot: ProjectRobot) => void;
  onCreateWebhook: (project: string, metadata: WebhookEventMetadata) => void;
  onEditWebhook: (
    project: string,
    webhook: ProjectWebhook,
    metadata: WebhookEventMetadata,
  ) => void;
  onShowWebhookHistory: (project: string, webhook: ProjectWebhook) => void;
  onDeleteWebhook: (project: string, webhook: ProjectWebhook) => void;
  onCreateImmutableRule: (project: string, metadata: RetentionMetadata) => void;
  onEditImmutableRule: (
    project: string,
    rule: ImmutableTagRule,
    metadata: RetentionMetadata,
  ) => void;
  onDeleteImmutableRule: (project: string, rule: ImmutableTagRule) => void;
  onCreateProjectLabel: (project: string, projectId: number) => void;
  onEditProjectLabel: (
    project: string,
    projectId: number,
    label: ProjectLabel,
  ) => void;
  onDeleteProjectLabel: (label: ProjectLabel) => void;
  onRetentionAction: (action: ProjectRetentionAction) => void;
  onPreheatAction?: (action: ProjectPreheatAction) => void;
  onDeleteProject?: (project: ProjectSummary) => void;
  onNotice?: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const routeKey = `${route.path}?${route.query.toString()}`;
  const routeState = useMemo(() => parseRoute(route), [routeKey]);
  const [data, setData] = useState<ProjectPageData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState(routeState.query);
  const [preferences, setPreferences] = useState(loadPreferences);
  const resourceTabsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setQuery(routeState.query);
    setSelectedIds(new Set());
  }, [routeKey, routeState.query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadProjectPage(routeState, controller.signal, isSystemAdmin, locale)
      .then(setData)
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isSystemAdmin, locale, reloadToken, routeKey, routeState]);

  useCenterActiveTab(
    resourceTabsRef,
    `${routeState.section}-${data ? "loaded" : "empty"}`,
  );

  const updateRoute = useCallback(
    (updates: Partial<ProjectDetailRoute>) => {
      navigate(projectSectionPath(routeState, updates));
    },
    [navigate, routeState],
  );
  const selectedRepositories = useMemo(
    () =>
      (data?.repositories ?? []).filter((repository) =>
        selectedIds.has(numberValue(repository.id)),
      ),
    [data?.repositories, selectedIds],
  );
  const allSelected =
    Boolean(data?.repositories.length) &&
    selectedRepositories.length === data?.repositories.length;
  async function refreshPage() {
    await onRefresh();
    setReloadToken((current) => current + 1);
  }

  function openRepository(
    event: MouseEvent<HTMLElement>,
    repository: RepositorySummary,
  ) {
    if ((event.target as HTMLElement).closest("input, button, a")) return;
    navigate(
      `projects/${encodeURIComponent(routeState.project)}/repositories/${encodeURIComponent(repository.name)}/artifacts`,
    );
  }

  function setViewMode(mode: "card" | "list") {
    const next = { ...preferences, repositoryView: mode };
    setPreferences(next);
    savePreferences(next);
  }

  const dataMatchesProject = data?.project.name === routeState.project;

  if ((!data || !dataMatchesProject) && loading) {
    return (
      <>
        <PageHeader
          title={routeState.project}
          subtitle={t("正在读取项目详情")}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: "项目中心", href: "#/projects" },
                { label: routeState.project },
              ]}
            />
          }
          actions={
            <RefreshButton refreshing={true} onRefresh={() => undefined} />
          }
        />
        {session.demo ? <DemoBanner /> : null}
        <section className="table-shell">
          <div className="route-loading" role="status">
            <span className="spinner spinner-small" />
          </div>
        </section>
      </>
    );
  }

  if (!data || !dataMatchesProject) {
    return (
      <div className="error-state" role="alert">
        <div>
          <span className="state-icon">
            <Icon name="alert" />
          </span>
          <h2>{t("项目详情载入失败")}</h2>
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
    );
  }

  const metadata = data.project.metadata ?? {};
  const memberCount =
    numberValue(data.summary.project_admin_count) +
    numberValue(data.summary.maintainer_count) +
    numberValue(data.summary.developer_count) +
    numberValue(data.summary.guest_count);
  const publicProject = String(metadata.public) === "true";
  const autoScan = String(metadata.auto_scan) === "true";
  const preventVulnerability = String(metadata.prevent_vul) === "true";
  const visibleProjectTabs = projectTabs.filter(
    (tab) =>
      isSystemAdmin ||
      hasPermission(data.permissions, tab.resource, tab.action),
  );
  return (
    <>
      <PageHeader
        title={data.project.name || routeState.project}
        subtitle={
          locale === "en-US"
            ? `${publicProject ? "Public" : "Private"} project · Owner ${data.project.owner_name ?? session.username}`
            : `${publicProject ? "公开" : "私有"}项目 · 所有者 ${data.project.owner_name ?? session.username}`
        }
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "项目中心", href: "#/projects" },
              { label: data.project.name || routeState.project },
            ]}
          />
        }
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => void refreshPage()}
            />
            <button
              className="button button-small"
              type="button"
              onClick={() =>
                updateRoute({ section: "settings", page: 1, query: "" })
              }
            >
              <Icon name="settings" />
              <span>{t("项目设置")}</span>
            </button>
          </>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      {error ? (
        <div className="warning-banner" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      ) : null}
      <section
        className="overview-stats project-stats"
        aria-label={t("项目统计")}
      >
        <StatCell
          label={t("仓库")}
          value={formatNumber(data.summary.repo_count, locale)}
          foot={t("项目中的镜像仓库")}
          icon="package"
        />
        <StatCell
          label={t("制品")}
          value={formatNumber(data.summary.artifact_count, locale)}
          foot={t("全部仓库制品")}
          icon="database"
        />
        <StatCell
          label={t("成员")}
          value={formatNumber(memberCount, locale)}
          foot={t("拥有项目权限")}
          icon="users"
        />
        <StatCell
          label={t("扫描策略")}
          value={t(autoScan ? "自动" : "手动")}
          foot={
            locale === "en-US"
              ? `Blocking level: ${preventVulnerability ? t(metadata.severity === "critical" ? "严重" : "高危") : "Off"}`
              : `阻断级别：${preventVulnerability ? t(metadata.severity === "critical" ? "严重" : "高危") : "关闭"}`
          }
          icon="shield"
        />
      </section>
      <nav
        ref={resourceTabsRef}
        className="resource-tabs"
        aria-label={t("项目页面")}
      >
        {visibleProjectTabs.map((tab) => (
          <a
            key={tab.section}
            href={`#/${projectSectionPath(routeState, {
              section: tab.section,
              page: 1,
              query: "",
            })}`}
            className={routeState.section === tab.section ? "active" : ""}
            aria-current={
              routeState.section === tab.section ? "page" : undefined
            }
          >
            <Icon name={tab.icon} />
            <span>{t(tab.label)}</span>
          </a>
        ))}
      </nav>
      <ContentTransition
        mode={`${routeState.section}:${preferences.repositoryView}`}
      >
        {data.permissionDenied ? (
          <section className="table-shell">
            <div className="empty-table permission-table">
              <strong>{t("没有访问此项目页面的权限")}</strong>
              <span>{t("当前账号缺少 Harbor 要求的项目资源权限。")}</span>
            </div>
          </section>
        ) : routeState.section === "members" ? (
          <div>
            <ProjectMembersSection
              project={routeState.project}
              members={data.members}
              pagination={data.pagination}
              initialQuery={routeState.query}
              onSearch={(nextQuery) =>
                updateRoute({ page: 1, query: nextQuery })
              }
              onPageChange={(page) => updateRoute({ page })}
              onAddMember={onAddMember}
              onEditMember={onEditMember}
              onDeleteMember={onDeleteMember}
            />
          </div>
        ) : routeState.section === "robots" ? (
          <div>
            <ProjectRobotsSection
              project={routeState.project}
              robots={data.robots}
              pagination={data.pagination}
              onPageChange={(page) => updateRoute({ page })}
              onCreate={(project) =>
                onCreateRobot(project, data.permissionMetadata?.project ?? [])
              }
              onEdit={(project, robot) =>
                onEditRobot(
                  project,
                  robot,
                  data.permissionMetadata?.project ?? [],
                )
              }
              onResetSecret={onResetRobotSecret}
              onDelete={onDeleteRobot}
            />
          </div>
        ) : routeState.section === "webhooks" ? (
          <div>
            <ProjectWebhooksSection
              project={routeState.project}
              webhooks={data.webhooks}
              pagination={data.pagination}
              onPageChange={(page) => updateRoute({ page })}
              onCreate={(project) =>
                onCreateWebhook(project, data.webhookEventMetadata)
              }
              onEdit={(project, webhook) =>
                onEditWebhook(project, webhook, data.webhookEventMetadata)
              }
              onHistory={onShowWebhookHistory}
              onDelete={onDeleteWebhook}
            />
          </div>
        ) : routeState.section === "rules" ? (
          <div>
            <ProjectRulesSection
              project={routeState.project}
              projectId={numberValue(data.project.project_id)}
              rules={data.immutableRules}
              labels={data.projectLabels}
              metadata={data.retentionMetadata}
              onCreateRule={onCreateImmutableRule}
              onEditRule={onEditImmutableRule}
              onDeleteRule={onDeleteImmutableRule}
              onCreateLabel={onCreateProjectLabel}
              onEditLabel={onEditProjectLabel}
              onDeleteLabel={onDeleteProjectLabel}
            />
          </div>
        ) : routeState.section === "retention" ? (
          <div>
            <ProjectRetentionSection
              project={routeState.project}
              projectId={numberValue(data.project.project_id)}
              policy={data.retentionPolicy}
              executions={data.retentionExecutions}
              pagination={data.retentionPagination}
              metadata={data.retentionMetadata}
              onPageChange={(page) => updateRoute({ page })}
              onAction={onRetentionAction}
            />
          </div>
        ) : routeState.section === "audit" ? (
          <div>
            <ProjectAuditSection
              logs={data.auditLogs}
              pagination={data.auditPagination}
              initialQuery={routeState.query}
              error={data.auditError}
              onSearch={(nextQuery) =>
                updateRoute({ page: 1, query: nextQuery })
              }
              onPageChange={(page) => updateRoute({ page })}
              onRetry={() => setReloadToken((current) => current + 1)}
            />
          </div>
        ) : routeState.section === "preheat" ? (
          <div>
            <ProjectPreheatSection
              project={routeState.project}
              projectId={numberValue(data.project.project_id)}
              policies={data.preheatPolicies}
              providers={data.preheatProviders}
              pagination={data.preheatPagination}
              initialQuery={routeState.query}
              errors={data.preheatErrors}
              onSearch={(nextQuery) =>
                updateRoute({ page: 1, query: nextQuery })
              }
              onPageChange={(page) => updateRoute({ page })}
              onAction={onPreheatAction}
            />
          </div>
        ) : routeState.section === "settings" ? (
          <div>
            <ProjectSettingsSection
              project={data.project}
              settings={data.settings}
              onSaved={() => setReloadToken((current) => current + 1)}
              onNotice={onNotice}
              onDelete={() => onDeleteProject(data.project)}
            />
          </div>
        ) : (
          <section className="table-shell">
            <div className="table-toolbar">
              <ToolbarSearchForm
                name="q"
                placeholder="按仓库名称搜索"
                value={query}
                onChange={setQuery}
                onSubmit={(value) => updateRoute({ page: 1, query: value })}
              />
              <button
                className="button button-small button-primary"
                type="button"
                onClick={() => onShowPushCommand(routeState.project)}
              >
                <Icon name="upload" />
                <span>{t("推送镜像")}</span>
              </button>
              <div className="toolbar-spacer" />
              <ViewModeToggle
                value={preferences.repositoryView}
                ariaLabel={t("仓库展示方式")}
                listLabel={t("列表视图")}
                cardLabel={t("卡片视图")}
                onChange={setViewMode}
              />
            </div>
            <div className="artifact-batch-toolbar repository-batch-toolbar">
              <span>
                <strong>
                  {formatNumber(selectedRepositories.length, locale)}
                </strong>{" "}
                {t("个已选择")}
              </span>
              <div>
                <button
                  className="button button-small button-danger"
                  type="button"
                  disabled={!selectedRepositories.length}
                  onClick={() =>
                    onDeleteRepositories(
                      routeState.project,
                      selectedRepositories,
                    )
                  }
                >
                  <Icon name="trash" />
                  <span>{t("删除仓库")}</span>
                </button>
              </div>
            </div>
            {!data.repositories.length ? (
              <div className="empty-state">
                <div>
                  <span className="state-icon">
                    <Icon name="package" />
                  </span>
                  <h2>{t("暂无仓库")}</h2>
                  <p>{t("镜像首次推送后会出现在这里。")}</p>
                </div>
              </div>
            ) : preferences.repositoryView === "card" ? (
              <div className="repository-card-grid">
                {data.repositories.map((repository) => {
                  const id = numberValue(repository.id);
                  const selected = selectedIds.has(id);
                  const name = displayRepositoryName(
                    routeState.project,
                    repository.name,
                  );
                  return (
                    <article
                      key={id || repository.name}
                      className={`repository-card${selected ? " selected" : ""}`}
                      onClick={(event) => openRepository(event, repository)}
                    >
                      <header>
                        <label className="repository-card-select">
                          <input
                            type="checkbox"
                            checked={selected}
                            aria-label={`${t("选择")} ${name}`}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (checked) next.add(id);
                                else next.delete(id);
                                return next;
                              });
                            }}
                          />
                        </label>
                        <div>
                          <button
                            type="button"
                            onClick={(event) =>
                              openRepository(event, repository)
                            }
                          >
                            {name}
                          </button>
                          <span className="mono">#{repository.id ?? "-"}</span>
                        </div>
                        <button
                          className="icon-button"
                          type="button"
                          title={t("推送指引")}
                          aria-label={t("查看推送指引")}
                          onClick={() =>
                            onShowPushCommand(
                              routeState.project,
                              repository.name,
                            )
                          }
                        >
                          <Icon name="upload" />
                        </button>
                      </header>
                      <p>
                        {descriptionOr(
                          repository.description,
                          t("暂无仓库描述"),
                        )}
                      </p>
                      <dl>
                        <div>
                          <dt>{t("制品")}</dt>
                          <dd>
                            {formatNumber(repository.artifact_count, locale)}
                          </dd>
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
                  );
                })}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="repository-select-table data-table-stable">
                  <StableTableColumns
                    widths={[
                      "44px",
                      "30%",
                      "11%",
                      "11%",
                      "20%",
                      "144px",
                      "44px",
                    ]}
                  />
                  <thead>
                    <tr>
                      <th className="selection-cell">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          aria-label={t("选择当前页全部仓库")}
                          onChange={(event) =>
                            setSelectedIds(
                              event.currentTarget.checked
                                ? new Set(
                                    data.repositories.map((repository) =>
                                      numberValue(repository.id),
                                    ),
                                  )
                                : new Set(),
                            )
                          }
                        />
                      </th>
                      <SortableHeader
                        label="仓库"
                        field="name"
                        currentSort={routeState.sort}
                        onSort={(sort) => updateRoute({ page: 1, sort })}
                      />
                      <SortableHeader
                        label="制品"
                        field="artifact_count"
                        descendingFirst
                        className="table-cell-number repository-metric-count"
                        currentSort={routeState.sort}
                        onSort={(sort) => updateRoute({ page: 1, sort })}
                      />
                      <SortableHeader
                        label="拉取次数"
                        field="pull_count"
                        descendingFirst
                        className="table-cell-number repository-metric-count"
                        currentSort={routeState.sort}
                        onSort={(sort) => updateRoute({ page: 1, sort })}
                      />
                      <th>{t("描述")}</th>
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
                    {data.repositories.map((repository) => {
                      const id = numberValue(repository.id);
                      const selected = selectedIds.has(id);
                      const name = displayRepositoryName(
                        routeState.project,
                        repository.name,
                      );
                      return (
                        <tr
                          key={id || repository.name}
                          className={`clickable-row${selected ? " selected-row" : ""}`}
                          onClick={(event) => openRepository(event, repository)}
                        >
                          <td className="selection-cell">
                            <input
                              type="checkbox"
                              checked={selected}
                              aria-label={`${t("选择")} ${name}`}
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                setSelectedIds((current) => {
                                  const next = new Set(current);
                                  if (checked) next.add(id);
                                  else next.delete(id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td>
                            <div className="cell-title">
                              <span className="cell-stack">
                                <strong>{name}</strong>
                                <small className="mono">
                                  #{repository.id ?? "-"}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td className="mono table-cell-number repository-metric-count">
                            {formatNumber(repository.artifact_count, locale)}
                          </td>
                          <td className="mono table-cell-number repository-metric-count">
                            {formatNumber(repository.pull_count, locale)}
                          </td>
                          <td className="truncate-cell">
                            {descriptionOr(repository.description, "-")}
                          </td>
                          <td className="table-cell-time">
                            {formatDate(repository.update_time, locale)}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                type="button"
                                title={t("推送指引")}
                                aria-label={t("查看推送指引")}
                                onClick={() =>
                                  onShowPushCommand(
                                    routeState.project,
                                    repository.name,
                                  )
                                }
                              >
                                <Icon name="upload" />
                              </button>
                              <Icon name="chevron" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              pagination={data.pagination}
              onPageChange={(page) => updateRoute({ page })}
              pageSizeOptions={[20, 50, 100]}
              onPageSizeChange={(pageSize) =>
                updateRoute({ page: 1, pageSize })
              }
            />
          </section>
        )}
      </ContentTransition>
    </>
  );
}
