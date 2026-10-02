import { ApiError, controlApi } from "../../app/api-client";
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
  WebhookEventMetadata,
} from "../../app/models";
import { type ProjectAuditError } from "./project-audit-section";
import { type ProjectSettingsData } from "./project-settings-section";
import { sortRepositories } from "../repositories/repository-sorting";

import {
  isSectionAllowed,
  type ProjectDetailRoute,
} from "./project-detail-routing";
export type ProjectPageData = {
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

async function loadRetentionMetadata(signal: AbortSignal) {
  return controlApi
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
    });
}

async function loadProjectRepositories(
  route: ProjectDetailRoute,
  locale: string,
  allRepositoriesRequest: Promise<RepositorySummary[]>,
): Promise<Partial<ProjectPageData>> {
  const repositoryRequest = allRepositoriesRequest.then((repositories) => {
    const query = route.query.trim().toLocaleLowerCase(locale);
    const sorted = sortRepositories(
      repositories.filter(
        (repository) =>
          !query || repository.name.toLocaleLowerCase(locale).includes(query),
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
  });
  const repositoryCollection = await repositoryRequest;
  return {
    repositories: repositoryCollection.items,
    pagination: repositoryCollection.pagination,
  };
}

async function loadProjectMembers(
  route: ProjectDetailRoute,
  signal: AbortSignal,
): Promise<Partial<ProjectPageData>> {
  const memberRequest = controlApi.list<ProjectMember>(
    "project-members",
    {
      project: route.project,
      page: route.page,
      page_size: route.pageSize,
      entityname: route.query,
    },
    signal,
  );
  const memberCollection = await memberRequest;
  return {
    members: memberCollection.items,
    pagination: memberCollection.pagination,
  };
}

async function loadProjectRobots(
  route: ProjectDetailRoute,
  signal: AbortSignal,
  project: ProjectSummary,
): Promise<Partial<ProjectPageData>> {
  const robotRequest = controlApi.list<ProjectRobot>(
    "robots",
    {
      page: route.page,
      page_size: route.pageSize,
      sort: "name",
      q: `Level=project,ProjectID=${String(project.project_id ?? "")}`,
    },
    signal,
  );
  const permissionMetadataRequest = controlApi.data<PermissionMetadata>(
    "permissions",
    {},
    signal,
  );
  const [robotCollection, permissionMetadata] = await Promise.all([
    robotRequest,
    permissionMetadataRequest,
  ]);
  return {
    robots: robotCollection.items,
    permissionMetadata,
    pagination: robotCollection.pagination,
  };
}

async function loadProjectWebhooks(
  route: ProjectDetailRoute,
  signal: AbortSignal,
): Promise<Partial<ProjectPageData>> {
  const webhookRequest = controlApi.list<ProjectWebhook>(
    "webhooks",
    {
      project: route.project,
      page: route.page,
      page_size: route.pageSize,
      sort: "name",
    },
    signal,
  );
  const webhookEventMetadataRequest = controlApi.data<WebhookEventMetadata>(
    "webhook-events",
    { project: route.project },
    signal,
  );
  const [webhookCollection, webhookEventMetadata] = await Promise.all([
    webhookRequest,
    webhookEventMetadataRequest,
  ]);
  return {
    webhooks: webhookCollection.items,
    webhookEventMetadata: webhookEventMetadata ?? {},
    pagination: webhookCollection.pagination,
  };
}

async function loadProjectRules(
  route: ProjectDetailRoute,
  signal: AbortSignal,
  project: ProjectSummary,
): Promise<Partial<ProjectPageData>> {
  const immutableRuleRequest = controlApi.list<ImmutableTagRule>(
    "immutable-rules",
    {
      project: route.project,
      page: 1,
      page_size: 100,
      sort: "priority",
    },
    signal,
  );
  const projectLabelRequest = controlApi.list<ProjectLabel>(
    "labels",
    {
      scope: "p",
      project_id: project.project_id,
      page: 1,
      page_size: 100,
      sort: "name",
    },
    signal,
  );
  const retentionMetadataRequest = loadRetentionMetadata(signal);
  const [immutableRuleCollection, projectLabelCollection, retentionMetadata] =
    await Promise.all([
      immutableRuleRequest,
      projectLabelRequest,
      retentionMetadataRequest,
    ]);
  return {
    immutableRules: immutableRuleCollection.items,
    projectLabels: projectLabelCollection.items,
    retentionMetadata: retentionMetadata ?? {},
  };
}

async function loadProjectRetention(
  route: ProjectDetailRoute,
  signal: AbortSignal,
  project: ProjectSummary,
): Promise<Partial<ProjectPageData>> {
  const retentionId = Number.parseInt(project.metadata?.retention_id ?? "", 10);
  const retentionMetadataRequest = loadRetentionMetadata(signal);
  const retentionPolicyRequest =
    Number.isFinite(retentionId) && retentionId > 0
      ? controlApi.data<RetentionPolicy>(
          "retention",
          { id: retentionId },
          signal,
        )
      : Promise.resolve(undefined);
  const retentionExecutionRequest =
    Number.isFinite(retentionId) && retentionId > 0
      ? controlApi.list<RetentionExecution>(
          "retention-executions",
          { id: retentionId, page: route.page, page_size: 20 },
          signal,
        )
      : Promise.resolve(undefined);
  const [retentionMetadata, retentionPolicy, retentionExecutionCollection] =
    await Promise.all([
      retentionMetadataRequest,
      retentionPolicyRequest,
      retentionExecutionRequest,
    ]);
  return {
    retentionMetadata: retentionMetadata ?? {},
    retentionPolicy,
    retentionExecutions: retentionExecutionCollection?.items ?? [],
    retentionPagination:
      retentionExecutionCollection?.pagination ?? emptyPagination(20),
  };
}

async function loadProjectAudit(
  route: ProjectDetailRoute,
  signal: AbortSignal,
): Promise<Partial<ProjectPageData>> {
  const auditRequest = controlApi
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
            auditError instanceof ApiError ? auditError.status : undefined,
        },
      };
    });
  const auditResult = await auditRequest;
  const auditCollection =
    "collection" in auditResult ? auditResult.collection : undefined;
  return {
    auditLogs: auditCollection?.items ?? [],
    auditPagination:
      auditCollection?.pagination ?? emptyPagination(route.pageSize),
    auditError: "error" in auditResult ? auditResult.error : undefined,
  };
}

async function loadProjectPreheat(
  route: ProjectDetailRoute,
  signal: AbortSignal,
): Promise<Partial<ProjectPageData>> {
  const preheatPolicyRequest = controlApi
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
    });
  const preheatProviderRequest = controlApi
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
    });
  const [preheatPolicyResult, preheatProviderResult] = await Promise.all([
    preheatPolicyRequest,
    preheatProviderRequest,
  ]);
  const preheatCollection =
    "collection" in preheatPolicyResult
      ? preheatPolicyResult.collection
      : undefined;
  return {
    preheatPolicies: preheatCollection?.items ?? [],
    preheatProviders:
      "providers" in preheatProviderResult
        ? preheatProviderResult.providers
        : [],
    preheatPagination:
      preheatCollection?.pagination ?? emptyPagination(route.pageSize),
    preheatErrors: [preheatPolicyResult, preheatProviderResult].flatMap(
      (result) => ("error" in result ? [result.error] : []),
    ),
  };
}

async function loadProjectSettings(
  route: ProjectDetailRoute,
  signal: AbortSignal,
  project: ProjectSummary,
): Promise<Partial<ProjectPageData>> {
  const settingsRequest = Promise.allSettled([
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
    ([scanner, candidates, proxyRegistry, quota]): ProjectSettingsData => {
      const quotaItems = quota.status === "fulfilled" ? quota.value.items : [];
      return {
        scanner: scanner.status === "fulfilled" ? scanner.value : undefined,
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
  );
  const settings = await settingsRequest;
  return { settings };
}

async function loadProjectSection(
  route: ProjectDetailRoute,
  project: ProjectSummary,
  signal: AbortSignal,
  locale: string,
  allRepositoriesRequest: Promise<RepositorySummary[]>,
): Promise<Partial<ProjectPageData>> {
  switch (route.section) {
    case "repositories":
      return loadProjectRepositories(route, locale, allRepositoriesRequest);
    case "members":
      return loadProjectMembers(route, signal);
    case "robots":
      return loadProjectRobots(route, signal, project);
    case "webhooks":
      return loadProjectWebhooks(route, signal);
    case "rules":
      return loadProjectRules(route, signal, project);
    case "retention":
      return loadProjectRetention(route, signal, project);
    case "audit":
      return loadProjectAudit(route, signal);
    case "preheat":
      return loadProjectPreheat(route, signal);
    case "settings":
      return loadProjectSettings(route, signal, project);
  }
}
function emptyPagination(pageSize: number): ControlPagination {
  return { page: 1, page_size: pageSize, total: 0 };
}

export async function loadProjectPage(
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
  const allRepositoriesRequest = listAllRepositories(route.project, signal);
  const sectionRequest = projectRequest.then(async (project) => {
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
    const sectionData = permissionDenied
      ? {}
      : await loadProjectSection(
          route,
          project,
          signal,
          locale,
          allRepositoriesRequest,
        );
    return { project, permissions, permissionDenied, sectionData };
  });
  const [
    { project, permissions, permissionDenied, sectionData },
    summary,
    allRepositories,
  ] = await Promise.all([
    sectionRequest,
    summaryRequest,
    allRepositoriesRequest,
  ]);
  return {
    project,
    permissions,
    permissionDenied,
    summary: {
      ...summary,
      repo_count: allRepositories.length,
      artifact_count: allRepositories.reduce(
        (total, repository) => total + numberValue(repository.artifact_count),
        0,
      ),
    },
    repositories: [],
    members: [],
    robots: [],
    webhooks: [],
    immutableRules: [],
    projectLabels: [],
    retentionMetadata: {},
    retentionExecutions: [],
    retentionPagination: emptyPagination(20),
    auditLogs: [],
    auditPagination: emptyPagination(route.pageSize),
    preheatPolicies: [],
    preheatProviders: [],
    preheatPagination: emptyPagination(route.pageSize),
    preheatErrors: [],
    settings: { candidates: [] },
    pagination: emptyPagination(route.pageSize),
    webhookEventMetadata: {},
    ...sectionData,
  };
}
