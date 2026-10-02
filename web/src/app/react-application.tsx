import { useConsoleSession } from "./use-console-session";
import type { ApplicationDialog } from "./application-dialog-host";
import { lazy, useCallback, useEffect, useState } from "react";

import { controlApi } from "./api-client";
import { useHashRouter } from "./hash-router";
import { useLocale } from "./locale-context";
import type { HarborIdentity, Session } from "./models";
import { AsyncContent } from "../components/async-content";
import { ErrorView, LoadingView } from "../components/feedback";
import { IconSprite } from "../components/icons";
import { ApplicationShell } from "../layouts/application-shell";

const LoginPage = lazy(() =>
  import("../features/auth/login-page").then((module) => ({
    default: module.LoginPage,
  })),
);
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
const ApplicationDialogHost = lazy(() =>
  import("./application-dialog-host").then((module) => ({
    default: module.ApplicationDialogHost,
  })),
);

type ToastMessage = {
  id: number;
  message: string;
  error?: boolean;
};

const viewTitles: Record<string, string> = {
  overview: "概览",
  projects: "项目中心",
  project: "项目详情",
  repositories: "镜像仓库",
  repository: "仓库详情",
  artifact: "制品详情",
  security: "制品安全",
  registries: "远程仓库",
  replication: "复制管理",
  preheat: "P2P 分发",
  audit: "审计日志",
  administration: "系统管理",
  system: "系统状态",
  about: "关于与 API",
};

export function ReactApplication() {
  const { route, navigate } = useHashRouter();
  const { t } = useLocale();
  const {
    session,
    consoleData,
    sessionError,
    isBooting,
    isRefreshing,
    authenticate: handleAuthenticated,
    refresh: handleRefresh,
    logout,
    updateIdentity,
  } = useConsoleSession(navigate);
  const [activeDialog, setActiveDialog] = useState<ApplicationDialog>();
  const [projectDetailVersion, setProjectDetailVersion] = useState(0);
  const [repositoryDetailVersion, setRepositoryDetailVersion] = useState(0);
  const [artifactDetailVersion, setArtifactDetailVersion] = useState(0);
  const [securityVersion, setSecurityVersion] = useState(0);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [replicationVersion, setReplicationVersion] = useState(0);
  const [preheatVersion, setPreheatVersion] = useState(0);
  const [toast, setToast] = useState<ToastMessage>();

  useEffect(() => {
    const pageTitle = session
      ? (viewTitles[route.view] ?? "页面不存在")
      : "连接实例";
    document.title = `${t(pageTitle)} · ${t("Harbor 控制台")}`;
  }, [route.view, session, t]);

  const showToast = useCallback((message: string, error = false) => {
    setToast({ id: Date.now(), message, error });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setActiveDialog(undefined);
  }, [session?.connection_id]);

  function handleIdentityChanged(identity: HarborIdentity, message: string) {
    updateIdentity(identity);
    showToast(message);
  }

  async function handleLogout() {
    await logout();
    setActiveDialog(undefined);
  }

  async function handleSessionChanged(current: Session, message: string) {
    setActiveDialog(undefined);
    await handleAuthenticated(current);
    showToast(message);
  }

  function handleSecurityChanged(message: string) {
    setActiveDialog(undefined);
    showToast(message);
    setSecurityVersion((current) => current + 1);
    void handleRefresh();
  }

  function handleRegistryChanged(message: string) {
    setActiveDialog(undefined);
    showToast(message);
    setRegistryVersion((current) => current + 1);
    void handleRefresh();
  }

  function handleReplicationChanged(message: string) {
    setActiveDialog(undefined);
    showToast(message);
    setReplicationVersion((current) => current + 1);
    void handleRefresh();
  }

  function handlePreheatInstanceChanged(message: string) {
    setActiveDialog(undefined);
    showToast(message);
    setPreheatVersion((current) => current + 1);
    void handleRefresh();
  }

  let content;
  if (isBooting) {
    content = (
      <div className="loading-state">
        <div>
          <span className="spinner" />
        </div>
      </div>
    );
  } else if (!session) {
    content = (
      <AsyncContent resetKey="login">
        <LoginPage
          onAuthenticated={(current) => void handleAuthenticated(current)}
          onNotice={showToast}
        />
      </AsyncContent>
    );
  } else {
    const dashboard = consoleData?.dashboard ?? {};
    content = (
      <ApplicationShell
        key={session.connection_id}
        session={session}
        dashboard={dashboard}
        identity={consoleData?.identity}
        permissions={consoleData?.permissions ?? []}
        activeView={
          ["artifact", "project", "repository"].includes(route.view)
            ? "projects"
            : route.view
        }
        navigate={navigate}
        onNotice={showToast}
        onIdentityChanged={handleIdentityChanged}
        onSessionChanged={handleSessionChanged}
        onLogout={() => void handleLogout()}
        contentKey={route.view}
      >
        <AsyncContent resetKey={route.path}>
          {!consoleData && !sessionError ? <LoadingView /> : null}
          {sessionError ? (
            <ErrorView
              message={sessionError}
              retry={() => void handleRefresh()}
            />
          ) : null}
          {consoleData && route.view === "overview" ? (
            <OverviewPage
              session={session}
              dashboard={consoleData.dashboard}
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
            />
          ) : null}
          {consoleData && route.view === "projects" ? (
            <ProjectsPage
              route={route}
              session={session}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={handleRefresh}
              onCreateProject={() => setActiveDialog({ kind: "create" })}
              onDeleteProjects={(projects) =>
                setActiveDialog({ kind: "delete", projects })
              }
              onExportProjectCve={(project) =>
                setActiveDialog({ kind: "export", project })
              }
            />
          ) : null}
          {consoleData && route.view === "repositories" ? (
            <RepositoriesPage
              route={route}
              session={session}
              projects={consoleData.dashboard.projects ?? []}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={handleRefresh}
              onShowPushCommand={(project, repository) =>
                setActiveDialog({ kind: "push-command", project, repository })
              }
            />
          ) : null}
          {consoleData && route.view === "project" ? (
            <ProjectDetailPage
              key={projectDetailVersion}
              route={route}
              session={session}
              isSystemAdmin={consoleData.identity?.sysadmin_flag === true}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={handleRefresh}
              onDeleteRepositories={(project, repositories) =>
                setActiveDialog({
                  kind: "delete-repositories",
                  project,
                  repositories,
                })
              }
              onShowPushCommand={(project, repository) =>
                setActiveDialog({ kind: "push-command", project, repository })
              }
              onAddMember={(project, members) =>
                setActiveDialog({ kind: "add-member", project, members })
              }
              onEditMember={(project, member) =>
                setActiveDialog({ kind: "edit-member", project, member })
              }
              onDeleteMember={(project, member) =>
                setActiveDialog({ kind: "delete-member", project, member })
              }
              onCreateRobot={(project, permissions) =>
                setActiveDialog({ kind: "create-robot", project, permissions })
              }
              onEditRobot={(project, robot, permissions) =>
                setActiveDialog({
                  kind: "edit-robot",
                  project,
                  robot,
                  permissions,
                })
              }
              onResetRobotSecret={(project, robot) =>
                setActiveDialog({ kind: "reset-robot", project, robot })
              }
              onDeleteRobot={(project, robot) =>
                setActiveDialog({ kind: "delete-robot", project, robot })
              }
              onCreateWebhook={(project, metadata) =>
                setActiveDialog({ kind: "create-webhook", project, metadata })
              }
              onEditWebhook={(project, webhook, metadata) =>
                setActiveDialog({
                  kind: "edit-webhook",
                  project,
                  webhook,
                  metadata,
                })
              }
              onShowWebhookHistory={(project, webhook) =>
                setActiveDialog({ kind: "webhook-history", project, webhook })
              }
              onDeleteWebhook={(project, webhook) =>
                setActiveDialog({ kind: "delete-webhook", project, webhook })
              }
              onCreateImmutableRule={(project, metadata) =>
                setActiveDialog({
                  kind: "create-immutable-rule",
                  project,
                  metadata,
                })
              }
              onEditImmutableRule={(project, rule, metadata) =>
                setActiveDialog({
                  kind: "edit-immutable-rule",
                  project,
                  rule,
                  metadata,
                })
              }
              onDeleteImmutableRule={(project, rule) =>
                setActiveDialog({
                  kind: "delete-immutable-rule",
                  project,
                  rule,
                })
              }
              onCreateProjectLabel={(project, projectId) =>
                setActiveDialog({
                  kind: "create-project-label",
                  project,
                  projectId,
                })
              }
              onEditProjectLabel={(project, projectId, label) =>
                setActiveDialog({
                  kind: "edit-project-label",
                  project,
                  projectId,
                  label,
                })
              }
              onDeleteProjectLabel={(label) =>
                setActiveDialog({ kind: "delete-project-label", label })
              }
              onRetentionAction={(action) => {
                if (
                  action.kind === "delete-rule" &&
                  (action.policy.rules?.length ?? 0) <= 1
                ) {
                  showToast(
                    "策略必须保留至少一条规则；如不再使用，请删除整个策略。",
                    true,
                  );
                  return;
                }
                setActiveDialog({ kind: "retention", action });
              }}
              onPreheatAction={(action) =>
                setActiveDialog({ kind: "preheat", action })
              }
              onDeleteProject={(project) => {
                void controlApi
                  .data<{ deletable?: boolean; message?: string }>(
                    "project-deletable",
                    { project: project.name },
                  )
                  .then((result) => {
                    if (result?.deletable !== true) {
                      showToast(
                        result?.message ?? "Harbor 当前不允许删除此项目。",
                        true,
                      );
                      return;
                    }
                    setActiveDialog({ kind: "delete-project", project });
                  })
                  .catch((deleteCheckError: unknown) => {
                    const message =
                      deleteCheckError instanceof Error
                        ? deleteCheckError.message
                        : String(deleteCheckError);
                    showToast(`无法确认项目是否可删除：${message}`, true);
                  });
              }}
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "repository" ? (
            <RepositoryDetailPage
              key={repositoryDetailVersion}
              route={route}
              session={session}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={handleRefresh}
              onShowPushCommand={(project, repository) =>
                setActiveDialog({ kind: "push-command", project, repository })
              }
              onEditRepository={(project, repository) =>
                setActiveDialog({
                  kind: "edit-repository",
                  project,
                  repository,
                })
              }
              onDeleteRepository={(project, repository) =>
                setActiveDialog({
                  kind: "delete-repository",
                  project,
                  repository,
                })
              }
              onArtifactAction={(action) => {
                if (
                  (action.kind === "attach-label" ||
                    action.kind === "remove-label") &&
                  !action.labels.length
                ) {
                  showToast(
                    action.kind === "attach-label"
                      ? "当前项目没有可用标签"
                      : "所选制品没有可移除的标签",
                    true,
                  );
                  return;
                }
                setActiveDialog({ kind: "artifact", action });
              }}
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "artifact" ? (
            <ArtifactDetailPage
              key={artifactDetailVersion}
              route={route}
              session={session}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={handleRefresh}
              onAction={(action) =>
                setActiveDialog({ kind: "artifact-detail", action })
              }
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "security" ? (
            <SecurityPage
              key={securityVersion}
              route={route}
              projects={consoleData.dashboard.projects ?? []}
              totalArtifacts={
                consoleData.dashboard.statistics?.total_artifact_count ?? 0
              }
              demo={session.demo}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={() => void handleRefresh()}
              onAction={(action) =>
                setActiveDialog({ kind: "security", action })
              }
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "registries" ? (
            <RegistriesPage
              key={registryVersion}
              demo={session.demo}
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
              onAction={(action) =>
                setActiveDialog({ kind: "registry", action })
              }
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "replication" ? (
            <ReplicationPage
              key={replicationVersion}
              route={route}
              demo={session.demo}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={() => void handleRefresh()}
              onAction={(action) => {
                if (
                  (action.kind === "create" || action.kind === "edit") &&
                  !action.registries.length
                ) {
                  showToast("请先创建一个远端仓库连接", true);
                  return;
                }
                setActiveDialog({ kind: "replication", action });
              }}
            />
          ) : null}
          {consoleData && route.view === "preheat" ? (
            <PreheatPage
              key={preheatVersion}
              demo={session.demo}
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
              onAction={(action) =>
                setActiveDialog({ kind: "preheat-instance", action })
              }
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "audit" ? (
            <AuditPage
              route={route}
              demo={session.demo}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={() => void handleRefresh()}
            />
          ) : null}
          {consoleData && route.view === "administration" ? (
            <AdministrationPage
              route={route}
              demo={session.demo}
              authMode={consoleData.dashboard.systeminfo?.auth_mode}
              hasRootCertificate={Boolean(
                consoleData.dashboard.systeminfo?.has_ca_root,
              )}
              refreshing={isRefreshing}
              navigate={navigate}
              onRefresh={() => void handleRefresh()}
              onNotice={showToast}
            />
          ) : null}
          {consoleData && route.view === "system" ? (
            <SystemPage
              session={session}
              dashboard={consoleData.dashboard}
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
            />
          ) : null}
          {consoleData && route.view === "about" ? (
            <AboutPage
              session={session}
              harborVersion={consoleData.dashboard.systeminfo?.harbor_version}
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
            />
          ) : null}
          {consoleData &&
          ![
            "artifact",
            "overview",
            "project",
            "projects",
            "repositories",
            "repository",
            "security",
            "registries",
            "replication",
            "preheat",
            "audit",
            "administration",
            "system",
            "about",
          ].includes(route.view) ? (
            <ErrorView
              title="页面不存在"
              message={t("请通过侧栏导航选择页面。")}
              retry={() => navigate("overview")}
            />
          ) : null}
        </AsyncContent>
      </ApplicationShell>
    );
  }

  return (
    <>
      <IconSprite />
      {content}
      {activeDialog && session ? (
        <AsyncContent
          resetKey={activeDialog.kind}
          onClose={() => setActiveDialog(undefined)}
        >
          <ApplicationDialogHost
            authMode={consoleData?.dashboard.systeminfo?.auth_mode ?? ""}
            activeDialog={activeDialog}
            setActiveDialog={setActiveDialog}
            session={session}
            route={route}
            navigate={navigate}
            showToast={showToast}
            handleRefresh={handleRefresh}
            setProjectDetailVersion={setProjectDetailVersion}
            setRepositoryDetailVersion={setRepositoryDetailVersion}
            setArtifactDetailVersion={setArtifactDetailVersion}
            handleSecurityChanged={handleSecurityChanged}
            handleRegistryChanged={handleRegistryChanged}
            handleReplicationChanged={handleReplicationChanged}
            handlePreheatInstanceChanged={handlePreheatInstanceChanged}
          />
        </AsyncContent>
      ) : null}
      <div
        id="toast-region"
        className="toast-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast ? (
          <div
            key={toast.id}
            className={`toast${toast.error ? " toast-error" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            {t(toast.message)}
          </div>
        ) : null}
      </div>
    </>
  );
}
