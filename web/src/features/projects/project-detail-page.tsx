import { useMemo, useRef, useState } from "react";

import { formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  HarborPermission,
  ImmutableTagRule,
  ProjectLabel,
  ProjectMember,
  ProjectRobot,
  ProjectSummary,
  ProjectWebhook,
  RepositorySummary,
  RetentionMetadata,
  Session,
  WebhookEventMetadata,
} from "../../app/models";
import { loadPreferences, savePreferences } from "../../app/preferences";
import { ContentTransition } from "../../components/content-transition";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import {
  Breadcrumb,
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { severityLabel } from "../../components/status-badge";
import { useCenterActiveTab } from "../../components/use-center-active-tab";
import type { ProjectPageData } from "./project-detail-data";
import {
  hasPermission,
  parseRoute,
  projectSectionPath,
  projectTabs,
  type ProjectDetailRoute,
} from "./project-detail-routing";
import { ProjectAuditSection } from "./project-audit-section";
import { ProjectMembersSection } from "./project-members-section";
import {
  ProjectPreheatSection,
  type ProjectPreheatAction,
} from "./project-preheat-section";
import { ProjectRepositoriesSection } from "./project-repositories-section";
import {
  ProjectRetentionSection,
  type ProjectRetentionAction,
} from "./project-retention-section";
import { ProjectRobotsSection } from "./project-robots-section";
import { ProjectRulesSection } from "./project-rules-section";
import { ProjectSettingsSection } from "./project-settings-section";
import { ProjectWebhooksSection } from "./project-webhooks-section";
import { useProjectPageData } from "./use-project-page-data";

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function ProjectStats({ data }: { data: ProjectPageData }) {
  const { locale, t } = useLocale();
  const metadata = data.project.metadata ?? {};
  const memberCount =
    numberValue(data.summary.project_admin_count) +
    numberValue(data.summary.maintainer_count) +
    numberValue(data.summary.developer_count) +
    numberValue(data.summary.guest_count);
  const autoScan = String(metadata.auto_scan) === "true";
  const blocking = String(metadata.prevent_vul) === "true";
  const blockingLevel = blocking
    ? t(severityLabel(metadata.severity ?? "high"))
    : locale === "en-US"
      ? "Off"
      : "关闭";
  return (
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
            ? `Blocking level: ${blockingLevel}`
            : `阻断级别：${blockingLevel}`
        }
        icon="shield"
      />
    </section>
  );
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
  // The key captures every route field, so parsing reruns only when the route changes.
  const routeState = useMemo(() => parseRoute(route), [routeKey]);
  const { data, loading, error, reload } = useProjectPageData(
    routeState,
    isSystemAdmin,
    locale,
  );
  const [preferences, setPreferences] = useState(loadPreferences);
  const resourceTabsRef = useRef<HTMLElement>(null);

  useCenterActiveTab(
    resourceTabsRef,
    `${routeState.section}-${data ? "loaded" : "empty"}`,
  );

  const project = routeState.project;
  const updateRoute = (updates: Partial<ProjectDetailRoute>) =>
    navigate(projectSectionPath(routeState, updates));
  const breadcrumb = (name: string) => (
    <Breadcrumb
      items={[{ label: "项目中心", href: "#/projects" }, { label: name }]}
    />
  );
  const dataMatchesProject = data?.project.name === project;

  if ((!data || !dataMatchesProject) && loading) {
    return (
      <>
        <PageHeader
          title={project}
          subtitle={t("正在读取项目详情")}
          breadcrumb={breadcrumb(project)}
          actions={<RefreshButton refreshing onRefresh={() => undefined} />}
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
      <ErrorView title="项目详情载入失败" message={error} retry={reload} />
    );
  }

  const projectId = numberValue(data.project.project_id);
  const projectName = data.project.name || project;
  const owner = data.project.owner_name ?? session.username;
  const publicProject = String(data.project.metadata?.public) === "true";
  const visibleTabs = projectTabs.filter(
    (tab) =>
      isSystemAdmin ||
      hasPermission(data.permissions, tab.resource, tab.action),
  );
  const searchSection = (nextQuery: string) =>
    updateRoute({ page: 1, query: nextQuery });
  const showPage = (page: number) => updateRoute({ page });

  const sectionContent = () => {
    if (data.permissionDenied) {
      return (
        <section className="table-shell">
          <ErrorView
            title="没有访问此项目页面的权限"
            message={t("当前账号缺少 Harbor 要求的项目资源权限。")}
          />
        </section>
      );
    }
    switch (routeState.section) {
      case "members":
        return (
          <ProjectMembersSection
            project={project}
            members={data.members}
            pagination={data.pagination}
            initialQuery={routeState.query}
            onSearch={searchSection}
            onPageChange={showPage}
            onAddMember={onAddMember}
            onEditMember={onEditMember}
            onDeleteMember={onDeleteMember}
          />
        );
      case "robots":
        return (
          <ProjectRobotsSection
            project={project}
            robots={data.robots}
            pagination={data.pagination}
            onPageChange={showPage}
            onCreate={(name) =>
              onCreateRobot(name, data.permissionMetadata?.project ?? [])
            }
            onEdit={(name, robot) =>
              onEditRobot(name, robot, data.permissionMetadata?.project ?? [])
            }
            onResetSecret={onResetRobotSecret}
            onDelete={onDeleteRobot}
          />
        );
      case "webhooks":
        return (
          <ProjectWebhooksSection
            project={project}
            webhooks={data.webhooks}
            pagination={data.pagination}
            onPageChange={showPage}
            onCreate={(name) =>
              onCreateWebhook(name, data.webhookEventMetadata)
            }
            onEdit={(name, webhook) =>
              onEditWebhook(name, webhook, data.webhookEventMetadata)
            }
            onHistory={onShowWebhookHistory}
            onDelete={onDeleteWebhook}
          />
        );
      case "rules":
        return (
          <ProjectRulesSection
            project={project}
            projectId={projectId}
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
        );
      case "retention":
        return (
          <ProjectRetentionSection
            project={project}
            projectId={projectId}
            policy={data.retentionPolicy}
            executions={data.retentionExecutions}
            pagination={data.retentionPagination}
            metadata={data.retentionMetadata}
            onPageChange={showPage}
            onAction={onRetentionAction}
          />
        );
      case "audit":
        return (
          <ProjectAuditSection
            logs={data.auditLogs}
            pagination={data.auditPagination}
            initialQuery={routeState.query}
            error={data.auditError}
            onSearch={searchSection}
            onPageChange={showPage}
            onRetry={reload}
          />
        );
      case "preheat":
        return (
          <ProjectPreheatSection
            project={project}
            projectId={projectId}
            policies={data.preheatPolicies}
            providers={data.preheatProviders}
            pagination={data.preheatPagination}
            initialQuery={routeState.query}
            errors={data.preheatErrors}
            onSearch={searchSection}
            onPageChange={showPage}
            onAction={onPreheatAction}
          />
        );
      case "settings":
        return (
          <ProjectSettingsSection
            project={data.project}
            settings={data.settings}
            onSaved={reload}
            onNotice={onNotice}
            onDelete={() => onDeleteProject(data.project)}
          />
        );
      default:
        return (
          <ProjectRepositoriesSection
            project={project}
            repositories={data.repositories}
            pagination={data.pagination}
            query={routeState.query}
            sort={routeState.sort}
            viewMode={preferences.repositoryView}
            onViewModeChange={(mode) => {
              const next = { ...preferences, repositoryView: mode };
              setPreferences(next);
              savePreferences(next);
            }}
            onSearch={searchSection}
            onSort={(sort) => updateRoute({ page: 1, sort })}
            onPageChange={showPage}
            onPageSizeChange={(pageSize) => updateRoute({ page: 1, pageSize })}
            onOpen={(repository) =>
              navigate(
                `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository.name)}/artifacts`,
              )
            }
            onShowPushCommand={(repository) => {
              if (repository) onShowPushCommand(project, repository.name);
              else onShowPushCommand(project);
            }}
            onDeleteRepositories={(repositories) =>
              onDeleteRepositories(project, repositories)
            }
          />
        );
    }
  };

  return (
    <>
      <PageHeader
        title={projectName}
        subtitle={
          locale === "en-US"
            ? `${publicProject ? "Public" : "Private"} project · Owner ${owner}`
            : `${publicProject ? "公开" : "私有"}项目 · 所有者 ${owner}`
        }
        breadcrumb={breadcrumb(projectName)}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => {
                void onRefresh().then(reload);
              }}
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
        <div className="notice notice-warning" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      ) : null}
      <ProjectStats data={data} />
      <nav
        ref={resourceTabsRef}
        className="resource-tabs"
        aria-label={t("项目页面")}
      >
        {visibleTabs.map((tab) => (
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
        <div>{sectionContent()}</div>
      </ContentTransition>
    </>
  );
}
