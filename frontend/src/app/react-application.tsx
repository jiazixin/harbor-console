import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  controlApi,
  dashboardApi,
  identityApi,
  sessionApi,
} from "./api-client";
import { useHashRouter } from "./hash-router";
import { useLocale } from "./locale-context";
import type {
  Dashboard,
  HarborIdentity,
  HarborPermission,
  ImmutableTagRule,
  ProjectLabel,
  ProjectMember,
  ProjectRobot,
  ProjectSummary,
  ProjectWebhook,
  RobotCredential,
  RepositorySummary,
  RetentionMetadata,
  Session,
  WebhookEventMetadata,
} from "./models";
import { ErrorView, LoadingView } from "../components/feedback";
import { IconSprite } from "../components/icons";
import { LoginPage } from "../features/auth/login-page";
import { AuditPage } from "../features/audit/audit-page";
import { AboutPage } from "../features/about/about-page";
import { AdministrationPage } from "../features/administration/administration-page";
import { OverviewPage } from "../features/overview/overview-page";
import { SystemPage } from "../features/system/system-page";
import {
  ArtifactLabelDialog,
  CopyArtifactDialog,
  DeleteArtifactsDialog,
} from "../features/artifacts/artifact-dialogs";
import {
  AddArtifactTagDialog,
  ArtifactScanDialog,
  ArtifactScanLogDialog,
  AttachArtifactLabelDialog,
  DeleteAccessoryArtifactDialog,
  DeleteArtifactDialog,
  DeleteArtifactTagDialog,
  RemoveArtifactLabelDialog,
  StopArtifactScanDialog,
} from "../features/artifacts/artifact-detail-dialogs";
import {
  ArtifactDetailPage,
  type ArtifactDetailAction,
} from "../features/artifacts/artifact-detail-page";
import {
  RepositoryDetailPage,
  type RepositoryArtifactAction,
} from "../features/artifacts/repository-detail-page";
import { RepositoriesPage } from "../features/repositories/repositories-page";
import {
  DeleteRegistryDialog,
  RegistryDialog,
} from "../features/registries/registry-dialogs";
import {
  RegistriesPage,
  type RegistryAction,
} from "../features/registries/registries-page";
import {
  DeleteReplicationPolicyDialog,
  ReplicationExecutionDialog,
  ReplicationPolicyDialog,
  RunReplicationPolicyDialog,
} from "../features/replication/replication-dialogs";
import {
  ReplicationPage,
  type ReplicationAction,
} from "../features/replication/replication-page";
import {
  DeletePreheatInstanceDialog,
  PreheatInstanceDialog,
} from "../features/preheat/preheat-dialogs";
import {
  PreheatPage,
  type PreheatInstanceAction,
} from "../features/preheat/preheat-page";
import {
  CveExportDetailDialog,
  CveExportDialog,
  DeleteScannerDialog,
  ScannerDialog,
  ScannerMetadataDialog,
  SystemAllowlistDialog,
} from "../features/security/security-dialogs";
import {
  SecurityPage,
  type SecurityAction,
} from "../features/security/security-page";
import { ProjectDetailPage } from "../features/projects/project-detail-page";
import {
  DeletePreheatPolicyDialog,
  PreheatExecutionsDialog,
  PreheatPolicyDialog,
  RunPreheatPolicyDialog,
} from "../features/projects/project-preheat-dialogs";
import type { ProjectPreheatAction } from "../features/projects/project-preheat-section";
import { ProjectsPage } from "../features/projects/projects-page";
import {
  CreateProjectDialog,
  DeleteProjectDialog,
  DeleteProjectsDialog,
  ProjectCveExportDialog,
} from "../features/projects/project-dialogs";
import {
  AddProjectMemberDialog,
  DeleteProjectMemberDialog,
  EditProjectMemberDialog,
} from "../features/projects/project-member-dialogs";
import {
  DeleteImmutableTagRuleDialog,
  DeleteProjectLabelDialog,
  ImmutableTagRuleDialog,
  ProjectLabelDialog,
} from "../features/projects/project-rule-dialogs";
import {
  CreateRetentionPolicyDialog,
  DeleteRetentionPolicyDialog,
  DeleteRetentionRuleDialog,
  RetentionExecutionDialog,
  RetentionRuleDialog,
  RetentionScheduleDialog,
  RunRetentionDialog,
  StopRetentionExecutionDialog,
} from "../features/projects/project-retention-dialogs";
import type { ProjectRetentionAction } from "../features/projects/project-retention-section";
import {
  DeleteProjectRobotDialog,
  ProjectRobotDialog,
  ResetRobotSecretDialog,
} from "../features/projects/project-robot-dialogs";
import { RobotCredentialDialog } from "../components/robot-credential-dialog";
import {
  DeleteProjectWebhookDialog,
  ProjectWebhookDialog,
  WebhookHistoryDialog,
} from "../features/projects/project-webhook-dialogs";
import {
  DeleteRepositoriesDialog,
  DeleteRepositoryDialog,
  EditRepositoryDialog,
  PushCommandDialog,
} from "../features/projects/repository-dialogs";
import { ApplicationShell } from "../layouts/application-shell";

type ConsoleData = {
  dashboard: Dashboard;
  identity?: HarborIdentity;
  permissions: HarborPermission[];
};

type ProjectDialog =
  | { kind: "create" }
  | { kind: "delete"; projects: ProjectSummary[] }
  | { kind: "delete-project"; project: ProjectSummary }
  | { kind: "export"; project: ProjectSummary }
  | {
      kind: "delete-repositories";
      project: string;
      repositories: RepositorySummary[];
    }
  | { kind: "push-command"; project: string; repository?: string }
  | {
      kind: "edit-repository";
      project: string;
      repository: RepositorySummary;
    }
  | {
      kind: "delete-repository";
      project: string;
      repository: RepositorySummary;
    }
  | { kind: "artifact"; action: RepositoryArtifactAction }
  | { kind: "add-member"; project: string; members: ProjectMember[] }
  | { kind: "edit-member"; project: string; member: ProjectMember }
  | { kind: "delete-member"; project: string; member: ProjectMember }
  | { kind: "create-robot"; project: string; permissions: HarborPermission[] }
  | {
      kind: "edit-robot";
      project: string;
      robot: ProjectRobot;
      permissions: HarborPermission[];
    }
  | { kind: "reset-robot"; project: string; robot: ProjectRobot }
  | { kind: "delete-robot"; project: string; robot: ProjectRobot }
  | {
      kind: "create-webhook";
      project: string;
      metadata: WebhookEventMetadata;
    }
  | {
      kind: "edit-webhook";
      project: string;
      webhook: ProjectWebhook;
      metadata: WebhookEventMetadata;
    }
  | { kind: "webhook-history"; project: string; webhook: ProjectWebhook }
  | { kind: "delete-webhook"; project: string; webhook: ProjectWebhook }
  | {
      kind: "create-immutable-rule";
      project: string;
      metadata: RetentionMetadata;
    }
  | {
      kind: "edit-immutable-rule";
      project: string;
      rule: ImmutableTagRule;
      metadata: RetentionMetadata;
    }
  | {
      kind: "delete-immutable-rule";
      project: string;
      rule: ImmutableTagRule;
    }
  | { kind: "create-project-label"; project: string; projectId: number }
  | {
      kind: "edit-project-label";
      project: string;
      projectId: number;
      label: ProjectLabel;
    }
  | { kind: "delete-project-label"; label: ProjectLabel }
  | { kind: "retention"; action: ProjectRetentionAction }
  | { kind: "preheat"; action: ProjectPreheatAction }
  | {
      kind: "robot-credential";
      credential: RobotCredential;
      source: "create" | "reset";
    }
  | { kind: "artifact-detail"; action: ArtifactDetailAction }
  | { kind: "security"; action: SecurityAction }
  | { kind: "registry"; action: RegistryAction }
  | { kind: "replication"; action: ReplicationAction }
  | { kind: "preheat-instance"; action: PreheatInstanceAction };

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

function RetentionDialogHost({
  action,
  onClose,
  onChanged,
  onNotice,
}: {
  action: ProjectRetentionAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  switch (action.kind) {
    case "create-policy":
      return (
        <CreateRetentionPolicyDialog
          project={action.project}
          projectId={action.projectId}
          metadata={action.metadata}
          onClose={onClose}
          onSaved={() => onChanged("Tag 保留策略已创建")}
        />
      );
    case "edit-schedule":
      return (
        <RetentionScheduleDialog
          projectId={action.projectId}
          policy={action.policy}
          onClose={onClose}
          onSaved={() => onChanged("Tag 保留执行计划已更新")}
        />
      );
    case "add-rule":
    case "edit-rule":
      return (
        <RetentionRuleDialog
          projectId={action.projectId}
          policy={action.policy}
          metadata={action.metadata}
          ruleIndex={action.kind === "edit-rule" ? action.ruleIndex : undefined}
          onClose={onClose}
          onSaved={() =>
            onChanged(
              action.kind === "edit-rule"
                ? "Tag 保留规则已更新"
                : "Tag 保留规则已添加",
            )
          }
        />
      );
    case "delete-rule":
      return (
        <DeleteRetentionRuleDialog
          projectId={action.projectId}
          policy={action.policy}
          ruleIndex={action.ruleIndex}
          onClose={onClose}
          onDeleted={() => onChanged("Tag 保留规则已删除")}
        />
      );
    case "delete-policy":
      return (
        <DeleteRetentionPolicyDialog
          policy={action.policy}
          onClose={onClose}
          onDeleted={() => onChanged("Tag 保留策略已删除")}
        />
      );
    case "run":
      return (
        <RunRetentionDialog
          policy={action.policy}
          dryRun={action.dryRun}
          onClose={onClose}
          onStarted={() =>
            onChanged(
              action.dryRun ? "Tag 保留演练已启动" : "Tag 保留任务已启动",
            )
          }
        />
      );
    case "stop-execution":
      return (
        <StopRetentionExecutionDialog
          policy={action.policy}
          execution={action.execution}
          onClose={onClose}
          onStopped={() => onChanged("Tag 保留执行已停止")}
        />
      );
    case "view-execution":
      return (
        <RetentionExecutionDialog
          project={action.project}
          policy={action.policy}
          execution={action.execution}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
  }
}

function PreheatDialogHost({
  action,
  onClose,
  onChanged,
  onNotice,
}: {
  action: ProjectPreheatAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  switch (action.kind) {
    case "create":
    case "edit":
      return (
        <PreheatPolicyDialog
          project={action.project}
          projectId={action.projectId}
          providers={action.providers}
          policy={action.kind === "edit" ? action.policy : undefined}
          onClose={onClose}
          onSaved={() =>
            onChanged(
              action.kind === "edit" ? "预热策略已更新" : "预热策略已创建",
            )
          }
        />
      );
    case "delete":
      return (
        <DeletePreheatPolicyDialog
          project={action.project}
          policy={action.policy}
          onClose={onClose}
          onDeleted={() => onChanged("预热策略已删除")}
        />
      );
    case "run":
      return (
        <RunPreheatPolicyDialog
          project={action.project}
          policy={action.policy}
          onClose={onClose}
          onStarted={() => onChanged("P2P 预热执行已启动")}
        />
      );
    case "executions":
      return (
        <PreheatExecutionsDialog
          project={action.project}
          policy={action.policy}
          onClose={onClose}
          onChanged={onChanged}
          onNotice={onNotice}
        />
      );
  }
}

function ArtifactDetailDialogHost({
  action,
  onClose,
  onChanged,
  onNavigate,
  onNotice,
}: {
  action: ArtifactDetailAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNavigate: (path: string, message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const context = {
    project: action.project,
    repository: action.repository,
    artifact: action.artifact,
  };
  switch (action.kind) {
    case "scan":
      return (
        <ArtifactScanDialog
          {...context}
          onClose={onClose}
          onSubmitted={(scanType) =>
            onChanged(
              scanType === "sbom"
                ? "SBOM 生成任务已提交"
                : "漏洞扫描任务已提交",
            )
          }
        />
      );
    case "stop-scan":
      return (
        <StopArtifactScanDialog
          {...context}
          scanType={action.scanType}
          onClose={onClose}
          onStopped={() =>
            onChanged(
              action.scanType === "sbom" ? "SBOM 生成已停止" : "漏洞扫描已停止",
            )
          }
        />
      );
    case "scan-log":
      return (
        <ArtifactScanLogDialog
          {...context}
          reportId={action.reportId}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
    case "add-tag":
      return (
        <AddArtifactTagDialog
          {...context}
          onClose={onClose}
          onCreated={(name) =>
            onNavigate(
              `projects/${encodeURIComponent(action.project)}/repositories/${encodeURIComponent(action.repository)}/artifacts/${encodeURIComponent(action.artifact.digest)}?tab=tags`,
              `Tag ${name} 已创建`,
            )
          }
        />
      );
    case "delete-tag":
      return (
        <DeleteArtifactTagDialog
          {...context}
          tag={action.tag}
          onClose={onClose}
          onDeleted={() => onChanged(`Tag ${action.tag.name} 已删除`)}
        />
      );
    case "attach-label":
      return (
        <AttachArtifactLabelDialog
          {...context}
          labels={action.labels}
          onClose={onClose}
          onAttached={(label) => onChanged(`标签 ${label.name} 已绑定`)}
        />
      );
    case "remove-label":
      return (
        <RemoveArtifactLabelDialog
          {...context}
          label={action.label}
          onClose={onClose}
          onRemoved={() => onChanged(`标签 ${action.label.name} 已移除`)}
        />
      );
    case "copy":
      return (
        <CopyArtifactDialog
          {...context}
          onClose={onClose}
          onCopied={(project, repository) =>
            onNavigate(
              `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`,
              "制品复制已完成",
            )
          }
        />
      );
    case "delete":
      return (
        <DeleteArtifactDialog
          {...context}
          onClose={onClose}
          onDeleted={() =>
            onNavigate(
              `projects/${encodeURIComponent(action.project)}/repositories/${encodeURIComponent(action.repository)}/artifacts`,
              "制品已删除",
            )
          }
        />
      );
    case "delete-accessory":
      return (
        <DeleteAccessoryArtifactDialog
          {...context}
          accessory={action.accessory}
          onClose={onClose}
          onDeleted={() => onChanged("关联制品已删除")}
        />
      );
  }
}

function ReplicationDialogHost({
  action,
  onClose,
  onChanged,
  onNotice,
}: {
  action: ReplicationAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  switch (action.kind) {
    case "create":
      return (
        <ReplicationPolicyDialog
          registries={action.registries}
          labels={action.labels}
          localInfo={action.localInfo}
          onClose={onClose}
          onSaved={() => onChanged("复制策略已创建")}
        />
      );
    case "edit":
      return (
        <ReplicationPolicyDialog
          policy={action.policy}
          registries={action.registries}
          labels={action.labels}
          localInfo={action.localInfo}
          onClose={onClose}
          onSaved={() => onChanged("复制策略已更新")}
        />
      );
    case "run":
      return (
        <RunReplicationPolicyDialog
          policy={action.policy}
          onClose={onClose}
          onStarted={() => onChanged("复制任务已启动")}
        />
      );
    case "delete":
      return (
        <DeleteReplicationPolicyDialog
          policy={action.policy}
          onClose={onClose}
          onDeleted={() => onChanged("复制策略已删除")}
        />
      );
    case "execution":
      return (
        <ReplicationExecutionDialog
          execution={action.execution}
          onClose={onClose}
          onChanged={onChanged}
          onNotice={onNotice}
        />
      );
  }
}

async function loadConsoleData(signal?: AbortSignal): Promise<ConsoleData> {
  const [dashboard, identity, permissions] = await Promise.all([
    dashboardApi.load(signal),
    identityApi.current(signal).catch(() => undefined),
    identityApi.permissions(signal).catch(() => []),
  ]);
  return { dashboard, identity, permissions };
}

export function ReactApplication() {
  const { route, navigate } = useHashRouter();
  const { t } = useLocale();
  const [session, setSession] = useState<Session>();
  const [data, setData] = useState<ConsoleData>();
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projectDialog, setProjectDialog] = useState<ProjectDialog>();
  const [projectDetailVersion, setProjectDetailVersion] = useState(0);
  const [repositoryDetailVersion, setRepositoryDetailVersion] = useState(0);
  const [artifactDetailVersion, setArtifactDetailVersion] = useState(0);
  const [securityVersion, setSecurityVersion] = useState(0);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [replicationVersion, setReplicationVersion] = useState(0);
  const [preheatVersion, setPreheatVersion] = useState(0);
  const [toast, setToast] = useState<ToastMessage>();

  useEffect(() => {
    const pageTitle = session ? viewTitles[route.view] : "连接实例";
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

  const refresh = useCallback(
    async (currentSession: Session, signal?: AbortSignal) => {
      setError("");
      try {
        setData(await loadConsoleData(signal));
        setSession(currentSession);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          setSession(undefined);
          setData(undefined);
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void sessionApi
      .current(controller.signal)
      .then(async (current) => {
        setSession(current);
        await refresh(current, controller.signal);
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof ApiError && loadError.status === 401)) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      })
      .finally(() => setBooting(false));
    return () => controller.abort();
  }, [refresh]);

  async function handleAuthenticated(current: Session) {
    setSession(current);
    setData(undefined);
    setError("");
    navigate("overview");
    await refresh(current);
  }

  async function handleRefresh() {
    if (!session || refreshing) return;
    setRefreshing(true);
    await refresh(session);
    setRefreshing(false);
  }

  async function handleLogout() {
    await sessionApi.logout().catch(() => null);
    setSession(undefined);
    setData(undefined);
    setError("");
    setProjectDialog(undefined);
  }

  function handleIdentityChanged(identity: HarborIdentity, message: string) {
    setData((current) => (current ? { ...current, identity } : current));
    showToast(message);
  }

  async function handleSessionChanged(current: Session, message: string) {
    setProjectDialog(undefined);
    setSession(current);
    setData(undefined);
    setError("");
    navigate("overview");
    await refresh(current);
    showToast(message);
  }

  function handleSecurityChanged(message: string) {
    setProjectDialog(undefined);
    showToast(message);
    setSecurityVersion((current) => current + 1);
    void handleRefresh();
  }

  function handleRegistryChanged(message: string) {
    setProjectDialog(undefined);
    showToast(message);
    setRegistryVersion((current) => current + 1);
    void handleRefresh();
  }

  function handleReplicationChanged(message: string) {
    setProjectDialog(undefined);
    showToast(message);
    setReplicationVersion((current) => current + 1);
    void handleRefresh();
  }

  function handlePreheatInstanceChanged(message: string) {
    setProjectDialog(undefined);
    showToast(message);
    setPreheatVersion((current) => current + 1);
    void handleRefresh();
  }

  let content;
  if (booting) {
    content = (
      <div className="loading-state">
        <div>
          <span className="spinner" />
        </div>
      </div>
    );
  } else if (!session) {
    content = (
      <LoginPage
        onAuthenticated={(current) => void handleAuthenticated(current)}
        onNotice={showToast}
      />
    );
  } else {
    const dashboard = data?.dashboard ?? {};
    content = (
      <ApplicationShell
        session={session}
        dashboard={dashboard}
        identity={data?.identity}
        permissions={data?.permissions ?? []}
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
        {!data && !error ? <LoadingView /> : null}
        {error ? (
          <ErrorView message={error} retry={() => void handleRefresh()} />
        ) : null}
        {data && route.view === "overview" ? (
          <OverviewPage
            session={session}
            dashboard={data.dashboard}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />
        ) : null}
        {data && route.view === "projects" ? (
          <ProjectsPage
            route={route}
            session={session}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={handleRefresh}
            onCreateProject={() => setProjectDialog({ kind: "create" })}
            onDeleteProjects={(projects) =>
              setProjectDialog({ kind: "delete", projects })
            }
            onExportProjectCve={(project) =>
              setProjectDialog({ kind: "export", project })
            }
          />
        ) : null}
        {data && route.view === "repositories" ? (
          <RepositoriesPage
            route={route}
            session={session}
            projects={data.dashboard.projects ?? []}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={handleRefresh}
            onShowPushCommand={(project, repository) =>
              setProjectDialog({ kind: "push-command", project, repository })
            }
          />
        ) : null}
        {data && route.view === "project" ? (
          <ProjectDetailPage
            key={projectDetailVersion}
            route={route}
            session={session}
            isSystemAdmin={data.identity?.sysadmin_flag === true}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={handleRefresh}
            onDeleteRepositories={(project, repositories) =>
              setProjectDialog({
                kind: "delete-repositories",
                project,
                repositories,
              })
            }
            onShowPushCommand={(project, repository) =>
              setProjectDialog({ kind: "push-command", project, repository })
            }
            onAddMember={(project, members) =>
              setProjectDialog({ kind: "add-member", project, members })
            }
            onEditMember={(project, member) =>
              setProjectDialog({ kind: "edit-member", project, member })
            }
            onDeleteMember={(project, member) =>
              setProjectDialog({ kind: "delete-member", project, member })
            }
            onCreateRobot={(project, permissions) =>
              setProjectDialog({ kind: "create-robot", project, permissions })
            }
            onEditRobot={(project, robot, permissions) =>
              setProjectDialog({
                kind: "edit-robot",
                project,
                robot,
                permissions,
              })
            }
            onResetRobotSecret={(project, robot) =>
              setProjectDialog({ kind: "reset-robot", project, robot })
            }
            onDeleteRobot={(project, robot) =>
              setProjectDialog({ kind: "delete-robot", project, robot })
            }
            onCreateWebhook={(project, metadata) =>
              setProjectDialog({ kind: "create-webhook", project, metadata })
            }
            onEditWebhook={(project, webhook, metadata) =>
              setProjectDialog({
                kind: "edit-webhook",
                project,
                webhook,
                metadata,
              })
            }
            onShowWebhookHistory={(project, webhook) =>
              setProjectDialog({ kind: "webhook-history", project, webhook })
            }
            onDeleteWebhook={(project, webhook) =>
              setProjectDialog({ kind: "delete-webhook", project, webhook })
            }
            onCreateImmutableRule={(project, metadata) =>
              setProjectDialog({
                kind: "create-immutable-rule",
                project,
                metadata,
              })
            }
            onEditImmutableRule={(project, rule, metadata) =>
              setProjectDialog({
                kind: "edit-immutable-rule",
                project,
                rule,
                metadata,
              })
            }
            onDeleteImmutableRule={(project, rule) =>
              setProjectDialog({
                kind: "delete-immutable-rule",
                project,
                rule,
              })
            }
            onCreateProjectLabel={(project, projectId) =>
              setProjectDialog({
                kind: "create-project-label",
                project,
                projectId,
              })
            }
            onEditProjectLabel={(project, projectId, label) =>
              setProjectDialog({
                kind: "edit-project-label",
                project,
                projectId,
                label,
              })
            }
            onDeleteProjectLabel={(label) =>
              setProjectDialog({ kind: "delete-project-label", label })
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
              setProjectDialog({ kind: "retention", action });
            }}
            onPreheatAction={(action) =>
              setProjectDialog({ kind: "preheat", action })
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
                  setProjectDialog({ kind: "delete-project", project });
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
        {data && route.view === "repository" ? (
          <RepositoryDetailPage
            key={repositoryDetailVersion}
            route={route}
            session={session}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={handleRefresh}
            onShowPushCommand={(project, repository) =>
              setProjectDialog({ kind: "push-command", project, repository })
            }
            onEditRepository={(project, repository) =>
              setProjectDialog({
                kind: "edit-repository",
                project,
                repository,
              })
            }
            onDeleteRepository={(project, repository) =>
              setProjectDialog({
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
              setProjectDialog({ kind: "artifact", action });
            }}
            onNotice={showToast}
          />
        ) : null}
        {data && route.view === "artifact" ? (
          <ArtifactDetailPage
            key={artifactDetailVersion}
            route={route}
            session={session}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={handleRefresh}
            onAction={(action) =>
              setProjectDialog({ kind: "artifact-detail", action })
            }
            onNotice={showToast}
          />
        ) : null}
        {data && route.view === "security" ? (
          <SecurityPage
            key={securityVersion}
            route={route}
            projects={data.dashboard.projects ?? []}
            totalArtifacts={
              data.dashboard.statistics?.total_artifact_count ?? 0
            }
            demo={session.demo}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={() => void handleRefresh()}
            onAction={(action) =>
              setProjectDialog({ kind: "security", action })
            }
            onNotice={showToast}
          />
        ) : null}
        {data && route.view === "registries" ? (
          <RegistriesPage
            key={registryVersion}
            demo={session.demo}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            onAction={(action) =>
              setProjectDialog({ kind: "registry", action })
            }
            onNotice={showToast}
          />
        ) : null}
        {data && route.view === "replication" ? (
          <ReplicationPage
            key={replicationVersion}
            route={route}
            demo={session.demo}
            refreshing={refreshing}
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
              setProjectDialog({ kind: "replication", action });
            }}
          />
        ) : null}
        {data && route.view === "preheat" ? (
          <PreheatPage
            key={preheatVersion}
            demo={session.demo}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            onAction={(action) =>
              setProjectDialog({ kind: "preheat-instance", action })
            }
            onNotice={showToast}
          />
        ) : null}
        {data && route.view === "audit" ? (
          <AuditPage
            route={route}
            demo={session.demo}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={() => void handleRefresh()}
          />
        ) : null}
        {data && route.view === "administration" ? (
          <AdministrationPage
            route={route}
            demo={session.demo}
            authMode={data.dashboard.systeminfo?.auth_mode}
            hasRootCertificate={Boolean(data.dashboard.systeminfo?.has_ca_root)}
            refreshing={refreshing}
            navigate={navigate}
            onRefresh={() => void handleRefresh()}
            onNotice={showToast}
          />
        ) : null}
        {data && route.view === "system" ? (
          <SystemPage
            session={session}
            dashboard={data.dashboard}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />
        ) : null}
        {data && route.view === "about" ? (
          <AboutPage
            session={session}
            harborVersion={data.dashboard.systeminfo?.harbor_version}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />
        ) : null}
        {data &&
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
          <div className="loading-state">
            <div>
              <span className="spinner" />
            </div>
          </div>
        ) : null}
      </ApplicationShell>
    );
  }

  return (
    <>
      <IconSprite />
      {content}
      {projectDialog?.kind === "create" ? (
        <CreateProjectDialog
          onClose={() => setProjectDialog(undefined)}
          onCreated={(name) => {
            setProjectDialog(undefined);
            showToast(`项目 ${name} 已创建`);
            navigate(`projects/${encodeURIComponent(name)}`);
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete" ? (
        <DeleteProjectsDialog
          projects={projectDialog.projects}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={(failures) => {
            const total = projectDialog.projects.length;
            setProjectDialog(undefined);
            showToast(
              failures
                ? `项目删除完成，${String(failures)} 项失败`
                : `${String(total)} 个项目已删除`,
              failures > 0,
            );
            if (!failures && total === 1 && route.view === "project") {
              navigate("projects");
            }
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete-project" ? (
        <DeleteProjectDialog
          project={projectDialog.project}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            const name = projectDialog.project.name;
            setProjectDialog(undefined);
            showToast(`项目 ${name} 已删除`);
            navigate("projects");
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "export" ? (
        <ProjectCveExportDialog
          project={projectDialog.project}
          onClose={() => setProjectDialog(undefined)}
          onCreated={(id) => {
            setProjectDialog(undefined);
            showToast(`CVE 导出任务 #${String(id ?? "-")} 已创建`);
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete-repositories" ? (
        <DeleteRepositoriesDialog
          project={projectDialog.project}
          repositories={projectDialog.repositories}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={(failures) => {
            const total = projectDialog.repositories.length;
            setProjectDialog(undefined);
            showToast(
              failures
                ? `仓库删除完成，${String(failures)} 项失败`
                : `${String(total)} 个仓库已删除`,
              failures > 0,
            );
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "push-command" && session ? (
        <PushCommandDialog
          project={projectDialog.project}
          repository={projectDialog.repository}
          session={session}
          onClose={() => setProjectDialog(undefined)}
          onCopied={(copyError) =>
            showToast(
              copyError ? "无法写入剪贴板" : "已复制到剪贴板",
              copyError,
            )
          }
        />
      ) : null}
      {projectDialog?.kind === "edit-repository" ? (
        <EditRepositoryDialog
          project={projectDialog.project}
          repository={projectDialog.repository}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("仓库描述已保存");
            setRepositoryDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete-repository" ? (
        <DeleteRepositoryDialog
          project={projectDialog.project}
          repository={projectDialog.repository}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            const project = projectDialog.project;
            setProjectDialog(undefined);
            showToast("仓库已删除");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
            navigate(`projects/${encodeURIComponent(project)}/repositories`);
          }}
        />
      ) : null}
      {projectDialog?.kind === "artifact" &&
      (projectDialog.action.kind === "attach-label" ||
        projectDialog.action.kind === "remove-label") ? (
        <ArtifactLabelDialog
          mode={
            projectDialog.action.kind === "attach-label" ? "attach" : "remove"
          }
          project={projectDialog.action.project}
          repository={projectDialog.action.repository}
          artifacts={projectDialog.action.artifacts}
          labels={projectDialog.action.labels}
          onClose={() => setProjectDialog(undefined)}
          onCompleted={(failures) => {
            const action = projectDialog.action;
            setProjectDialog(undefined);
            showToast(
              failures
                ? `${action.kind === "attach-label" ? "添加" : "移除"}标签完成，${String(failures)} 项失败`
                : action.kind === "attach-label"
                  ? "标签已添加"
                  : "标签已移除",
              failures > 0,
            );
            setRepositoryDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "artifact" &&
      projectDialog.action.kind === "copy" ? (
        <CopyArtifactDialog
          project={projectDialog.action.project}
          repository={projectDialog.action.repository}
          artifact={projectDialog.action.artifact}
          onClose={() => setProjectDialog(undefined)}
          onCopied={(project, repository) => {
            setProjectDialog(undefined);
            showToast("制品复制已完成");
            navigate(
              `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`,
            );
          }}
        />
      ) : null}
      {projectDialog?.kind === "artifact" &&
      projectDialog.action.kind === "delete" ? (
        <DeleteArtifactsDialog
          project={projectDialog.action.project}
          repository={projectDialog.action.repository}
          artifacts={projectDialog.action.artifacts}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={(failures) => {
            const total =
              projectDialog.action.kind === "delete"
                ? projectDialog.action.artifacts.length
                : 0;
            setProjectDialog(undefined);
            showToast(
              failures
                ? `制品删除完成，${String(failures)} 项失败`
                : `${String(total)} 个制品已删除`,
              failures > 0,
            );
            setRepositoryDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "artifact-detail" ? (
        <ArtifactDetailDialogHost
          action={projectDialog.action}
          onClose={() => setProjectDialog(undefined)}
          onChanged={(message) => {
            setProjectDialog(undefined);
            showToast(message);
            setArtifactDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
          onNavigate={(path, message) => {
            setProjectDialog(undefined);
            showToast(message);
            setArtifactDetailVersion((current) => current + 1);
            void handleRefresh();
            navigate(path);
          }}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "add-member" ? (
        <AddProjectMemberDialog
          project={projectDialog.project}
          existingMembers={projectDialog.members}
          authMode={data?.dashboard.systeminfo?.auth_mode ?? ""}
          onClose={() => setProjectDialog(undefined)}
          onCreated={() => {
            setProjectDialog(undefined);
            showToast("项目成员已添加");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "edit-member" ? (
        <EditProjectMemberDialog
          project={projectDialog.project}
          member={projectDialog.member}
          onClose={() => setProjectDialog(undefined)}
          onUpdated={() => {
            setProjectDialog(undefined);
            showToast("成员角色已更新");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete-member" ? (
        <DeleteProjectMemberDialog
          project={projectDialog.project}
          member={projectDialog.member}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            setProjectDialog(undefined);
            showToast("项目成员已删除");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {projectDialog?.kind === "create-robot" ? (
        <ProjectRobotDialog
          project={projectDialog.project}
          permissionCandidates={projectDialog.permissions}
          onClose={() => setProjectDialog(undefined)}
          onCreated={(credential) =>
            setProjectDialog({
              kind: "robot-credential",
              credential,
              source: "create",
            })
          }
          onUpdated={() => undefined}
        />
      ) : null}
      {projectDialog?.kind === "edit-robot" ? (
        <ProjectRobotDialog
          project={projectDialog.project}
          robot={projectDialog.robot}
          permissionCandidates={projectDialog.permissions}
          onClose={() => setProjectDialog(undefined)}
          onCreated={() => undefined}
          onUpdated={() => {
            setProjectDialog(undefined);
            showToast("机器人账号已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "reset-robot" ? (
        <ResetRobotSecretDialog
          robot={projectDialog.robot}
          onClose={() => setProjectDialog(undefined)}
          onReset={(credential) =>
            setProjectDialog({
              kind: "robot-credential",
              credential,
              source: "reset",
            })
          }
        />
      ) : null}
      {projectDialog?.kind === "delete-robot" ? (
        <DeleteProjectRobotDialog
          project={projectDialog.project}
          robot={projectDialog.robot}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            setProjectDialog(undefined);
            showToast("机器人账号已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "create-webhook" ? (
        <ProjectWebhookDialog
          project={projectDialog.project}
          metadata={projectDialog.metadata}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("Webhook 已创建");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "edit-webhook" ? (
        <ProjectWebhookDialog
          project={projectDialog.project}
          webhook={projectDialog.webhook}
          metadata={projectDialog.metadata}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("Webhook 已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "webhook-history" ? (
        <WebhookHistoryDialog
          project={projectDialog.project}
          webhook={projectDialog.webhook}
          onClose={() => setProjectDialog(undefined)}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "delete-webhook" ? (
        <DeleteProjectWebhookDialog
          project={projectDialog.project}
          webhook={projectDialog.webhook}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            setProjectDialog(undefined);
            showToast("Webhook 已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "create-immutable-rule" ? (
        <ImmutableTagRuleDialog
          project={projectDialog.project}
          metadata={projectDialog.metadata}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("不可变规则已创建");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "edit-immutable-rule" ? (
        <ImmutableTagRuleDialog
          project={projectDialog.project}
          rule={projectDialog.rule}
          metadata={projectDialog.metadata}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("不可变规则已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete-immutable-rule" ? (
        <DeleteImmutableTagRuleDialog
          project={projectDialog.project}
          rule={projectDialog.rule}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            setProjectDialog(undefined);
            showToast("不可变规则已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "create-project-label" ? (
        <ProjectLabelDialog
          project={projectDialog.project}
          projectId={projectDialog.projectId}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("项目标签已创建");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "edit-project-label" ? (
        <ProjectLabelDialog
          project={projectDialog.project}
          projectId={projectDialog.projectId}
          label={projectDialog.label}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => {
            setProjectDialog(undefined);
            showToast("项目标签已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "delete-project-label" ? (
        <DeleteProjectLabelDialog
          label={projectDialog.label}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => {
            setProjectDialog(undefined);
            showToast("项目标签已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {projectDialog?.kind === "retention" ? (
        <RetentionDialogHost
          action={projectDialog.action}
          onClose={() => setProjectDialog(undefined)}
          onChanged={(message) => {
            setProjectDialog(undefined);
            showToast(message);
            setProjectDetailVersion((current) => current + 1);
          }}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "preheat" ? (
        <PreheatDialogHost
          action={projectDialog.action}
          onClose={() => setProjectDialog(undefined)}
          onChanged={(message) => {
            setProjectDialog(undefined);
            showToast(message);
            setProjectDetailVersion((current) => current + 1);
          }}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "robot-credential" ? (
        <RobotCredentialDialog
          credential={projectDialog.credential}
          onClose={() => {
            const message =
              projectDialog.source === "reset"
                ? "机器人密钥已重置"
                : "机器人账号已创建";
            setProjectDialog(undefined);
            showToast(message);
            setProjectDetailVersion((current) => current + 1);
          }}
          onCopied={(copyError) =>
            showToast(
              copyError ? "无法写入剪贴板" : "已复制到剪贴板",
              copyError,
            )
          }
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "create-scanner" ? (
        <ScannerDialog
          canDisable={projectDialog.action.canDisable}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handleSecurityChanged("扫描器已注册")}
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "edit-scanner" ? (
        <ScannerDialog
          scanner={projectDialog.action.scanner}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handleSecurityChanged("扫描器已更新")}
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "scanner-metadata" ? (
        <ScannerMetadataDialog
          scanner={projectDialog.action.scanner}
          onClose={() => setProjectDialog(undefined)}
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "delete-scanner" ? (
        <DeleteScannerDialog
          scanner={projectDialog.action.scanner}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => handleSecurityChanged("扫描器已删除")}
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "edit-allowlist" ? (
        <SystemAllowlistDialog
          allowlist={projectDialog.action.allowlist}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handleSecurityChanged("系统 CVE 白名单已保存")}
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "create-export" ? (
        <CveExportDialog
          projects={projectDialog.action.projects}
          onClose={() => setProjectDialog(undefined)}
          onCreated={(id) =>
            handleSecurityChanged(`CVE 导出任务 #${String(id ?? "-")} 已创建`)
          }
        />
      ) : null}
      {projectDialog?.kind === "security" &&
      projectDialog.action.kind === "export-detail" ? (
        <CveExportDetailDialog
          execution={projectDialog.action.execution}
          onClose={() => setProjectDialog(undefined)}
        />
      ) : null}
      {projectDialog?.kind === "registry" &&
      projectDialog.action.kind === "create" ? (
        <RegistryDialog
          adapters={projectDialog.action.adapters}
          adapterInfos={projectDialog.action.adapterInfos}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handleRegistryChanged("远端仓库已创建")}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "registry" &&
      projectDialog.action.kind === "edit" ? (
        <RegistryDialog
          registry={projectDialog.action.registry}
          adapters={projectDialog.action.adapters}
          adapterInfos={projectDialog.action.adapterInfos}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handleRegistryChanged("远端仓库已更新")}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "registry" &&
      projectDialog.action.kind === "delete" ? (
        <DeleteRegistryDialog
          registry={projectDialog.action.registry}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => handleRegistryChanged("远端仓库连接已删除")}
        />
      ) : null}
      {projectDialog?.kind === "replication" ? (
        <ReplicationDialogHost
          action={projectDialog.action}
          onClose={() => setProjectDialog(undefined)}
          onChanged={handleReplicationChanged}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "preheat-instance" &&
      projectDialog.action.kind === "create" ? (
        <PreheatInstanceDialog
          providers={projectDialog.action.providers}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handlePreheatInstanceChanged("P2P 实例已创建")}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "preheat-instance" &&
      projectDialog.action.kind === "edit" ? (
        <PreheatInstanceDialog
          instance={projectDialog.action.instance}
          providers={projectDialog.action.providers}
          onClose={() => setProjectDialog(undefined)}
          onSaved={() => handlePreheatInstanceChanged("P2P 实例已更新")}
          onNotice={showToast}
        />
      ) : null}
      {projectDialog?.kind === "preheat-instance" &&
      projectDialog.action.kind === "delete" ? (
        <DeletePreheatInstanceDialog
          instance={projectDialog.action.instance}
          onClose={() => setProjectDialog(undefined)}
          onDeleted={() => handlePreheatInstanceChanged("P2P 实例已删除")}
        />
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
