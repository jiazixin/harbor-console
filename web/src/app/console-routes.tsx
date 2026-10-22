import { lazy } from "react";

import { ErrorView } from "../components/feedback";
import type { RepositoryArtifactAction } from "../features/artifacts/repository-detail-page";
import type { ProjectRetentionAction } from "../features/projects/project-retention-section";
import type { ReplicationAction } from "../features/replication/replication-page";
import { controlApi } from "./api-client";
import type { ApplicationDialog } from "./application-dialogs";
import type { ConsoleRoute } from "./hash-router";
import { useLocale } from "./locale-context";
import type { ProjectSummary, Session } from "./models";
import type { PageVersions } from "./page-versions";
import type { ConsoleData } from "./use-console-session";

const AuditPage = lazy(() =>
  import("../features/audit/audit-page").then((module) => ({
    default: module.AuditPage,
  })),
);
const AboutPage = lazy(() =>
  import("../features/about/about-page").then((module) => ({
    default: module.AboutPage,
  })),
);
const AdministrationPage = lazy(() =>
  import("../features/administration/administration-page").then((module) => ({
    default: module.AdministrationPage,
  })),
);
const OverviewPage = lazy(() =>
  import("../features/overview/overview-page").then((module) => ({
    default: module.OverviewPage,
  })),
);
const SystemPage = lazy(() =>
  import("../features/system/system-page").then((module) => ({
    default: module.SystemPage,
  })),
);
const ArtifactDetailPage = lazy(() =>
  import("../features/artifacts/artifact-detail-page").then((module) => ({
    default: module.ArtifactDetailPage,
  })),
);
const RepositoryDetailPage = lazy(() =>
  import("../features/artifacts/repository-detail-page").then((module) => ({
    default: module.RepositoryDetailPage,
  })),
);
const RepositoriesPage = lazy(() =>
  import("../features/repositories/repositories-page").then((module) => ({
    default: module.RepositoriesPage,
  })),
);
const RegistriesPage = lazy(() =>
  import("../features/registries/registries-page").then((module) => ({
    default: module.RegistriesPage,
  })),
);
const ReplicationPage = lazy(() =>
  import("../features/replication/replication-page").then((module) => ({
    default: module.ReplicationPage,
  })),
);
const PreheatPage = lazy(() =>
  import("../features/preheat/preheat-page").then((module) => ({
    default: module.PreheatPage,
  })),
);
const SecurityPage = lazy(() =>
  import("../features/security/security-page").then((module) => ({
    default: module.SecurityPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import("../features/projects/project-detail-page").then((module) => ({
    default: module.ProjectDetailPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("../features/projects/projects-page").then((module) => ({
    default: module.ProjectsPage,
  })),
);

/** Document titles of the console views; unknown views are not found. */
export const viewTitles: Record<string, string> = {
  overview: "概览",
  projects: "项目中心",
  project: "项目详情",
  repositories: "镜像仓库",
  repository: "仓库详情",
  artifact: "制品详情",
  security: "制品安全",
  registries: "远端仓库",
  replication: "复制管理",
  preheat: "P2P 分发",
  audit: "审计日志",
  administration: "系统管理",
  system: "系统状态",
  about: "关于与 API",
};

/** Detail views highlight their parent entry in the navigation. */
export function navigationView(view: string): string {
  return ["artifact", "project", "repository"].includes(view)
    ? "projects"
    : view;
}

type ConsoleRouteContext = {
  route: ConsoleRoute;
  session: Session;
  consoleData: ConsoleData;
  refreshing: boolean;
  versions: PageVersions;
  navigate: (path: string) => void;
  refresh: () => Promise<void>;
  openDialog: (dialog: ApplicationDialog) => void;
  notify: (message: string, error?: boolean) => void;
};

function openRetentionDialog(
  action: ProjectRetentionAction,
  { openDialog, notify }: ConsoleRouteContext,
) {
  // Harbor rejects a retention policy without rules.
  if (
    action.kind === "delete-rule" &&
    (action.policy.rules?.length ?? 0) <= 1
  ) {
    notify("策略必须保留至少一条规则；如不再使用，请删除整个策略。", true);
    return;
  }
  openDialog({ kind: "retention", action });
}

async function confirmProjectDeletable(
  project: ProjectSummary,
  { openDialog, notify }: ConsoleRouteContext,
) {
  try {
    const result = await controlApi.data<{
      deletable?: boolean;
      message?: string;
    }>("project-deletable", { project: project.name });
    if (result?.deletable === true) {
      openDialog({ kind: "delete-project", project });
    } else {
      notify(result?.message ?? "Harbor 当前不允许删除此项目。", true);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify(`无法确认项目是否可删除：${message}`, true);
  }
}

function openArtifactDialog(
  action: RepositoryArtifactAction,
  { openDialog, notify }: ConsoleRouteContext,
) {
  if (action.kind === "attach-label" && !action.labels.length) {
    notify("当前项目没有可用标签", true);
    return;
  }
  if (action.kind === "remove-label" && !action.labels.length) {
    notify("所选制品没有可移除的标签", true);
    return;
  }
  openDialog({ kind: "artifact", action });
}

function openReplicationDialog(
  action: ReplicationAction,
  { openDialog, notify }: ConsoleRouteContext,
) {
  const editsPolicy = action.kind === "create" || action.kind === "edit";
  if (editsPolicy && !action.registries.length) {
    notify("请先创建一个远端仓库连接", true);
    return;
  }
  openDialog({ kind: "replication", action });
}

function ProjectDetailRoute(context: ConsoleRouteContext) {
  const {
    route,
    session,
    consoleData,
    refreshing,
    versions,
    navigate,
    refresh,
    openDialog,
    notify,
  } = context;
  return (
    <ProjectDetailPage
      key={versions.project}
      route={route}
      session={session}
      isSystemAdmin={consoleData.identity?.sysadmin_flag === true}
      refreshing={refreshing}
      navigate={navigate}
      onRefresh={refresh}
      onDeleteRepositories={(project, repositories) =>
        openDialog({
          kind: "delete-repositories",
          project,
          repositories,
        })
      }
      onShowPushCommand={(project, repository) =>
        openDialog({ kind: "push-command", project, repository })
      }
      onAddMember={(project, members) =>
        openDialog({ kind: "add-member", project, members })
      }
      onEditMember={(project, member) =>
        openDialog({ kind: "edit-member", project, member })
      }
      onDeleteMember={(project, member) =>
        openDialog({ kind: "delete-member", project, member })
      }
      onCreateRobot={(project, permissions) =>
        openDialog({ kind: "create-robot", project, permissions })
      }
      onEditRobot={(project, robot, permissions) =>
        openDialog({
          kind: "edit-robot",
          project,
          robot,
          permissions,
        })
      }
      onResetRobotSecret={(project, robot) =>
        openDialog({ kind: "reset-robot", project, robot })
      }
      onDeleteRobot={(project, robot) =>
        openDialog({ kind: "delete-robot", project, robot })
      }
      onCreateWebhook={(project, metadata) =>
        openDialog({ kind: "create-webhook", project, metadata })
      }
      onEditWebhook={(project, webhook, metadata) =>
        openDialog({
          kind: "edit-webhook",
          project,
          webhook,
          metadata,
        })
      }
      onShowWebhookHistory={(project, webhook) =>
        openDialog({ kind: "webhook-history", project, webhook })
      }
      onDeleteWebhook={(project, webhook) =>
        openDialog({ kind: "delete-webhook", project, webhook })
      }
      onCreateImmutableRule={(project, metadata) =>
        openDialog({
          kind: "create-immutable-rule",
          project,
          metadata,
        })
      }
      onEditImmutableRule={(project, rule, metadata) =>
        openDialog({
          kind: "edit-immutable-rule",
          project,
          rule,
          metadata,
        })
      }
      onDeleteImmutableRule={(project, rule) =>
        openDialog({
          kind: "delete-immutable-rule",
          project,
          rule,
        })
      }
      onCreateProjectLabel={(project, projectId) =>
        openDialog({
          kind: "create-project-label",
          project,
          projectId,
        })
      }
      onEditProjectLabel={(project, projectId, label) =>
        openDialog({
          kind: "edit-project-label",
          project,
          projectId,
          label,
        })
      }
      onDeleteProjectLabel={(label) =>
        openDialog({ kind: "delete-project-label", label })
      }
      onRetentionAction={(action) => openRetentionDialog(action, context)}
      onPreheatAction={(action) => openDialog({ kind: "preheat", action })}
      onDeleteProject={(project) =>
        void confirmProjectDeletable(project, context)
      }
      onNotice={notify}
    />
  );
}

/** Renders the page of the current console route. */
export function ConsoleRouteContent(context: ConsoleRouteContext) {
  const { t } = useLocale();
  const {
    route,
    session,
    consoleData,
    refreshing,
    versions,
    navigate,
    refresh,
    openDialog,
    notify,
  } = context;
  const { dashboard } = consoleData;
  const refreshPage = () => void refresh();

  switch (route.view) {
    case "overview":
      return (
        <OverviewPage
          session={session}
          dashboard={dashboard}
          refreshing={refreshing}
          onRefresh={refreshPage}
        />
      );
    case "projects":
      return (
        <ProjectsPage
          route={route}
          session={session}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refresh}
          onCreateProject={() => openDialog({ kind: "create" })}
          onDeleteProjects={(projects) =>
            openDialog({ kind: "delete", projects })
          }
          onExportProjectCve={(project) =>
            openDialog({ kind: "export", project })
          }
        />
      );
    case "repositories":
      return (
        <RepositoriesPage
          route={route}
          session={session}
          projects={dashboard.projects ?? []}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refresh}
          onShowPushCommand={(project, repository) =>
            openDialog({ kind: "push-command", project, repository })
          }
        />
      );
    case "project":
      return <ProjectDetailRoute {...context} />;
    case "repository":
      return (
        <RepositoryDetailPage
          key={versions.repository}
          route={route}
          session={session}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refresh}
          onShowPushCommand={(project, repository) =>
            openDialog({ kind: "push-command", project, repository })
          }
          onEditRepository={(project, repository) =>
            openDialog({ kind: "edit-repository", project, repository })
          }
          onDeleteRepository={(project, repository) =>
            openDialog({ kind: "delete-repository", project, repository })
          }
          onArtifactAction={(action) => openArtifactDialog(action, context)}
          onNotice={notify}
        />
      );
    case "artifact":
      return (
        <ArtifactDetailPage
          key={versions.artifact}
          route={route}
          session={session}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refresh}
          onAction={(action) => openDialog({ kind: "artifact-detail", action })}
          onNotice={notify}
        />
      );
    case "security":
      return (
        <SecurityPage
          key={versions.security}
          route={route}
          projects={dashboard.projects ?? []}
          totalArtifacts={dashboard.statistics?.total_artifact_count ?? 0}
          demo={session.demo}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refreshPage}
          onAction={(action) => openDialog({ kind: "security", action })}
          onNotice={notify}
        />
      );
    case "registries":
      return (
        <RegistriesPage
          key={versions.registries}
          demo={session.demo}
          refreshing={refreshing}
          onRefresh={refreshPage}
          onAction={(action) => openDialog({ kind: "registry", action })}
          onNotice={notify}
        />
      );
    case "replication":
      return (
        <ReplicationPage
          key={versions.replication}
          route={route}
          demo={session.demo}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refreshPage}
          onAction={(action) => openReplicationDialog(action, context)}
        />
      );
    case "preheat":
      return (
        <PreheatPage
          key={versions.preheat}
          demo={session.demo}
          refreshing={refreshing}
          onRefresh={refreshPage}
          onAction={(action) =>
            openDialog({ kind: "preheat-instance", action })
          }
          onNotice={notify}
        />
      );
    case "audit":
      return (
        <AuditPage
          route={route}
          demo={session.demo}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refreshPage}
        />
      );
    case "administration":
      return (
        <AdministrationPage
          route={route}
          demo={session.demo}
          authMode={dashboard.systeminfo?.auth_mode}
          hasRootCertificate={Boolean(dashboard.systeminfo?.has_ca_root)}
          refreshing={refreshing}
          navigate={navigate}
          onRefresh={refreshPage}
          onNotice={notify}
        />
      );
    case "system":
      return (
        <SystemPage
          session={session}
          dashboard={dashboard}
          refreshing={refreshing}
          onRefresh={refreshPage}
        />
      );
    case "about":
      return (
        <AboutPage
          session={session}
          harborVersion={dashboard.systeminfo?.harbor_version}
          refreshing={refreshing}
          onRefresh={refreshPage}
        />
      );
    default:
      return (
        <ErrorView
          title="页面不存在"
          message={t("请通过侧栏导航选择页面。")}
          retry={() => navigate("overview")}
          retryLabel="返回概览"
        />
      );
  }
}
